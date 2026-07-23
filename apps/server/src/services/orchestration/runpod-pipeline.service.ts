import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { generateNarrationAudio } from '../audio/audio.service.js';
import { generateImagesFromPrompts } from '../images/image-generation.service.js';
import { generateNarrative } from '../narratives/narrative.service.js';
import { generatePromptPack } from '../prompts/prompt-generation.service.js';
import { generateSocialMetadata } from '../social-metadata/social-metadata.service.js';
import { generateSceneVideoPreview } from '../videos/scene-video.service.js';
import { kickoffRender } from '../renders/render.service.js';

type RunpodStatusResponse = {
  actual_mode?: string;
  stage?: string;
  transitioning?: boolean;
};

type FullPipelineResult = {
  narrative: Awaited<ReturnType<typeof generateNarrative>>;
  prompts: Awaited<ReturnType<typeof generatePromptPack>>;
  socialMetadata: Awaited<ReturnType<typeof generateSocialMetadata>>;
  audio: Awaited<ReturnType<typeof generateNarrationAudio>>;
  images: Awaited<ReturnType<typeof generateImagesFromPrompts>>;
  video: Awaited<ReturnType<typeof kickoffRender>>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const gatewayBaseUrl = () => env.runpodGatewayBaseUrl.replace(/\/$/, '');

const postControl = async (path: string, payload: Record<string, unknown> = {}) => {
  const response = await fetch(`${gatewayBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `Runpod control request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'RUNPOD_CONTROL_FAILED',
    );
  }

  return response.json().catch(() => ({}));
};

const getStatus = async () => {
  const response = await fetch(`${gatewayBaseUrl()}/control/status`);
  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `Runpod status request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'RUNPOD_STATUS_FAILED',
    );
  }

  return (await response.json()) as RunpodStatusResponse;
};

const waitForMode = async (mode: string, timeoutMs = 20 * 60 * 1000) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await getStatus();
    if (status.actual_mode === mode && !status.transitioning && status.stage === 'idle') {
      return status;
    }

    if (status.actual_mode === 'conflict') {
      throw new AppError('Runpod gateway reported a conflicting GPU state.', 502, 'RUNPOD_CONFLICT_STATE');
    }

    await sleep(5000);
  }

  throw new AppError(`Timed out waiting for Runpod mode: ${mode}.`, 504, 'RUNPOD_MODE_TIMEOUT');
};

const switchMode = async (mode: 'off' | 'llm' | 'tts' | 'image' | 'video') => {
  if (mode === 'off') {
    await postControl('/control/off', {});
    return waitForMode('off');
  }

  await postControl(`/control/${mode}/start`, mode === 'llm' ? { warmup: true } : {});
  return waitForMode(mode);
};

export const runpodPipelineService = {
  async generateFullPipeline(topic: string): Promise<FullPipelineResult> {
    const normalizedTopic = topic.trim();
    if (!normalizedTopic) {
      throw new AppError('A topic is required to run the full pipeline.', 400, 'TOPIC_REQUIRED');
    }

    await switchMode('llm');
    const narrative = await generateNarrative({ topic: normalizedTopic });
    const prompts = await generatePromptPack({ narrative: narrative.narrative, topic: normalizedTopic });
    const socialMetadata = await generateSocialMetadata({
      narrative: narrative.narrative,
      topic: normalizedTopic,
    });
    await switchMode('off');

    await switchMode('tts');
    const audio = await generateNarrationAudio({
      text: narrative.narrative,
      topic: normalizedTopic,
    });
    const narrativeWithAudio = {
      ...narrative,
      audioDurationInSeconds: audio.audioDurationInSeconds,
      audioUrl: audio.audioUrl,
      captions: audio.captions,
    };
    await switchMode('off');

    await switchMode('image');
    const images = await generateImagesFromPrompts(prompts.prompts);
    await switchMode('off');

    await switchMode('video');
    let updatedImages = images.images;
    for (const [sceneIndex, image] of updatedImages.entries()) {
      const response = await generateSceneVideoPreview({
        image,
        sceneIndex,
      });
      updatedImages = updatedImages.map((entry) => (entry.id === response.image.id ? response.image : entry));
    }
    await switchMode('off');

    const render = await kickoffRender({
      audioDurationInSeconds: narrativeWithAudio.audioDurationInSeconds,
      audioUrl: narrativeWithAudio.audioUrl,
      captions: narrativeWithAudio.captions,
      images: updatedImages,
      topic: normalizedTopic,
    });

    return {
      narrative: narrativeWithAudio,
      prompts,
      socialMetadata,
      audio,
      images: { images: updatedImages },
      video: render,
    };
  },
};
