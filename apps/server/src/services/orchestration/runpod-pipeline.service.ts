import { AppError } from '../../lib/app-error.js';
import { generateNarrationAudio } from '../audio/audio.service.js';
import { generateImagesFromPrompts } from '../images/image-generation.service.js';
import { generateNarrative } from '../narratives/narrative.service.js';
import { generatePromptPack } from '../prompts/prompt-generation.service.js';
import { generateSocialMetadata } from '../social-metadata/social-metadata.service.js';
import { generateSceneVideoPreview } from '../videos/scene-video.service.js';
import { kickoffRender } from '../renders/render.service.js';
import { switchRunpodMode } from '../runpod/runpod-mode.service.js';

type FullPipelineResult = {
  narrative: Awaited<ReturnType<typeof generateNarrative>>;
  prompts: Awaited<ReturnType<typeof generatePromptPack>>;
  socialMetadata: Awaited<ReturnType<typeof generateSocialMetadata>>;
  audio: Awaited<ReturnType<typeof generateNarrationAudio>>;
  images: Awaited<ReturnType<typeof generateImagesFromPrompts>>;
  video: Awaited<ReturnType<typeof kickoffRender>>;
};

export const runpodPipelineService = {
  async generateFullPipeline(topic: string): Promise<FullPipelineResult> {
    const normalizedTopic = topic.trim();
    if (!normalizedTopic) {
      throw new AppError('A topic is required to run the full pipeline.', 400, 'TOPIC_REQUIRED');
    }

    await switchRunpodMode('llm');
    const narrative = await generateNarrative({ topic: normalizedTopic });
    const prompts = await generatePromptPack({ narrative: narrative.narrative, topic: normalizedTopic });
    const socialMetadata = await generateSocialMetadata({
      narrative: narrative.narrative,
      topic: normalizedTopic,
    });
    await switchRunpodMode('off');

    await switchRunpodMode('tts');
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
    await switchRunpodMode('off');

    await switchRunpodMode('image');
    const images = await generateImagesFromPrompts(prompts.prompts);
    await switchRunpodMode('off');

    await switchRunpodMode('video');
    let updatedImages = images.images;
    for (const [sceneIndex, image] of updatedImages.entries()) {
      const response = await generateSceneVideoPreview({
        image,
        sceneIndex,
      });
      updatedImages = updatedImages.map((entry) => (entry.id === response.image.id ? response.image : entry));
    }
    await switchRunpodMode('off');

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
