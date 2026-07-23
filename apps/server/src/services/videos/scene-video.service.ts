import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { buildImageToVideoPrompt } from '../prompts/prompt-constraints.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDirectory, '../../../../../');
const generatedVideosDirectory = path.resolve(workspaceRoot, 'generated-videos');

type SceneVideoRequest = {
  image: {
    id?: unknown;
    promptId?: unknown;
    promptText?: unknown;
    sourceImageUrl?: unknown;
    url?: unknown;
    videoPromptText?: unknown;
  };
  sceneIndex: number;
};

type RunpodVideoCreateResponse = {
  job_id?: string;
  status_url?: string;
  url?: string;
};

type RunpodVideoJobResponse = {
  status?: string;
  url?: string;
  log?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeId = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
};

const ensureGeneratedVideosDirectory = async () => {
  await fs.mkdir(generatedVideosDirectory, { recursive: true });
};

const isClearlyLocalOrPrivateHost = (hostName: string) => {
  const normalized = hostName.trim().toLowerCase();
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0' || normalized === '::1') return true;
  if (normalized.startsWith('10.') || normalized.startsWith('192.168.')) return true;
  const secondOctetMatch = normalized.match(/^172\.(\d{1,3})\./);
  if (secondOctetMatch) {
    const secondOctet = Number(secondOctetMatch[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }
  return false;
};

const getFirstFrameImageUrl = (imageUrl: string) => {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new AppError('Scene video generation needs a valid first-frame image URL.', 400, 'SCENE_VIDEO_IMAGE_URL_INVALID');
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new AppError('Scene video generation requires an http or https image URL.', 400, 'SCENE_VIDEO_IMAGE_URL_INVALID');
  }

  if (isClearlyLocalOrPrivateHost(parsed.hostname)) {
    throw new AppError('Runpod must fetch the first-frame image from a publicly reachable URL. use the Runpod gateway base URL so the image can be reached publicly before generating scene video.', 400, 'SCENE_VIDEO_IMAGE_NOT_PUBLIC');
  }

  return parsed.toString();
};

const createRunpodVideoTask = async ({ firstFrameImage, prompt }: { firstFrameImage: string; prompt: string; }) => {
  const form = new FormData();
  const imageResponse = await fetch(firstFrameImage);
  if (!imageResponse.ok) {
    throw new AppError('Failed to fetch first-frame image for video generation.', 502, 'RUNPOD_VIDEO_IMAGE_FETCH_FAILED');
  }

  const imageBytes = await imageResponse.arrayBuffer();
  form.set('image', new Blob([imageBytes], { type: imageResponse.headers.get('content-type') || 'image/png' }), 'input.png');
  form.set('prompt', prompt);
  form.set('width', '480');
  form.set('height', '832');
  form.set('num_frames', '121');
  form.set('fps', '24');
  form.set('steps', '12');
  form.set('guidance_scale', '1.0');

  const response = await fetch(`${env.runpodGatewayBaseUrl.replace(/\/$/, '')}/v1/videos/generations`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok && response.status !== 202) {
    const bodyText = await response.text();
    throw new AppError(
      `Runpod video request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'RUNPOD_VIDEO_CREATE_FAILED',
    );
  }

  const payload = (await response.json()) as RunpodVideoCreateResponse;
  const jobId = normalizeId(payload.job_id);
  if (!jobId) {
    throw new AppError('Runpod video request did not return a job id.', 502, 'RUNPOD_VIDEO_JOB_MISSING');
  }

  return jobId;
};

const queryRunpodVideoTask = async (jobId: string) => {
  const response = await fetch(`${env.runpodGatewayBaseUrl.replace(/\/$/, '')}/v1/videos/jobs/${encodeURIComponent(jobId)}`);
  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `Runpod video status query failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'RUNPOD_VIDEO_QUERY_FAILED',
    );
  }
  return (await response.json()) as RunpodVideoJobResponse;
};

const waitForRunpodVideo = async (jobId: string) => {
  for (let attempt = 0; attempt < env.minimaxVideoPollMaxAttempts; attempt += 1) {
    const payload = await queryRunpodVideoTask(jobId);
    const status = (payload.status ?? '').trim().toLowerCase();
    if (status === 'completed' || status === 'success') {
      if (!payload.url) {
        throw new AppError('Runpod video completed without a download URL.', 502, 'RUNPOD_VIDEO_URL_MISSING');
      }
      return payload.url;
    }
    if (status === 'failed' || status === 'fail' || status === 'error') {
      throw new AppError('Runpod video generation failed.', 502, 'RUNPOD_VIDEO_FAILED');
    }
    await sleep(env.minimaxVideoPollIntervalMs);
  }

  throw new AppError('Runpod video generation timed out while waiting for the preview clip.', 504, 'RUNPOD_VIDEO_TIMEOUT');
};

const downloadSceneVideo = async ({ downloadUrl, imageId, sceneIndex, sourcePrompt }: { downloadUrl: string; imageId: string; sceneIndex: number; sourcePrompt: string; }) => {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `Runpod video download failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'RUNPOD_VIDEO_DOWNLOAD_FAILED',
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const hash = crypto.createHash('sha1').update(`${imageId}-${sceneIndex}-${sourcePrompt}`).digest('hex').slice(0, 16);
  const fileName = `scene-${sceneIndex + 1}-${hash}.mp4`;
  const filePath = path.join(generatedVideosDirectory, fileName);

  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
  return `${env.runpodGatewayBaseUrl.replace(/\/$/, '')}/generated-videos/${fileName}`;
};

export const generateSceneVideoPreview = async ({ image, sceneIndex }: SceneVideoRequest) => {
  const imageId = typeof image.id === 'string' && image.id.trim().length > 0 ? image.id : `img_${sceneIndex + 1}`;
  const sourceImageUrl = typeof image.sourceImageUrl === 'string' && image.sourceImageUrl.trim().length > 0 ? image.sourceImageUrl.trim() : '';
  const imageUrl = typeof image.url === 'string' ? image.url.trim() : '';
  const videoPromptText = typeof image.videoPromptText === 'string' ? image.videoPromptText.trim() : '';
  const promptText = typeof image.promptText === 'string' ? image.promptText.trim() : '';

  if ((!sourceImageUrl && !imageUrl) || !videoPromptText) {
    throw new AppError('Scene video generation requires both an image URL and an image-to-video prompt.', 400, 'SCENE_VIDEO_INPUT_INVALID');
  }

  await ensureGeneratedVideosDirectory();
  const firstFrameImage = getFirstFrameImageUrl(sourceImageUrl || imageUrl);
  const jobId = await createRunpodVideoTask({ firstFrameImage, prompt: buildImageToVideoPrompt(videoPromptText) });
  const downloadUrl = await waitForRunpodVideo(jobId);
  const videoUrl = await downloadSceneVideo({ downloadUrl, imageId, sceneIndex, sourcePrompt: videoPromptText });

  return {
    image: {
      id: imageId,
      promptId: typeof image.promptId === 'string' ? image.promptId : `prompt_${sceneIndex + 1}`,
      promptText,
      sourceImageUrl: sourceImageUrl || imageUrl,
      url: imageUrl,
      videoDurationInSeconds: env.minimaxVideoDurationSeconds,
      videoPromptText,
      videoUrl,
    },
  };
};
