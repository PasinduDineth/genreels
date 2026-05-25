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

type MiniMaxVideoCreateResponse = {
  data?: {
    task_id?: string | number;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  task_id?: string | number;
};

type MiniMaxVideoQueryResponse = {
  data?: {
    file_id?: string | number;
    status?: string;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  file_id?: string | number;
  status?: string;
};

type MiniMaxFileRetrieveResponse = {
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  file?: {
    download_url?: string;
    filename?: string;
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeId = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
};

const ensureGeneratedVideosDirectory = async () => {
  await fs.mkdir(generatedVideosDirectory, { recursive: true });
};

const isClearlyLocalOrPrivateHost = (hostName: string) => {
  const normalized = hostName.trim().toLowerCase();

  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized === '::1'
  ) {
    return true;
  }

  if (normalized.startsWith('10.') || normalized.startsWith('192.168.')) {
    return true;
  }

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
    throw new AppError(
      'Scene video generation needs a valid first-frame image URL.',
      400,
      'SCENE_VIDEO_IMAGE_URL_INVALID',
    );
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new AppError(
      'Scene video generation requires an http or https image URL.',
      400,
      'SCENE_VIDEO_IMAGE_URL_INVALID',
    );
  }

  if (isClearlyLocalOrPrivateHost(parsed.hostname)) {
    throw new AppError(
      'MiniMax must fetch the first-frame image from a publicly reachable URL. Set PUBLIC_BASE_URL to a public host or tunnel before generating scene video.',
      400,
      'SCENE_VIDEO_IMAGE_NOT_PUBLIC',
    );
  }

  return parsed.toString();
};

const createMiniMaxVideoTask = async ({
  firstFrameImage,
  prompt,
}: {
  firstFrameImage: string;
  prompt: string;
}) => {
  const response = await fetch(env.minimaxVideoBaseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.minimaxApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      aigc_watermark: false,
      duration: env.minimaxVideoDurationSeconds,
      first_frame_image: firstFrameImage,
      model: env.minimaxVideoModel,
      prompt,
      resolution: env.minimaxVideoResolution,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `MiniMax image-to-video request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'MINIMAX_VIDEO_CREATE_FAILED',
    );
  }

  const payload = (await response.json()) as MiniMaxVideoCreateResponse;
  console.log('[minimax:video] Create response', payload);

  const statusCode = payload.base_resp?.status_code;
  const statusMessage = payload.base_resp?.status_msg?.trim();
  if (typeof statusCode === 'number' && statusCode !== 0) {
    throw new AppError(
      `MiniMax image-to-video request failed${statusMessage ? `: ${statusMessage}` : '.'}`,
      502,
      'MINIMAX_VIDEO_CREATE_FAILED',
    );
  }

  const taskId = normalizeId(payload.task_id ?? payload.data?.task_id);
  if (!taskId) {
    throw new AppError(
      `MiniMax image-to-video request did not return a task id${statusMessage ? `: ${statusMessage}` : '.'}`,
      502,
      'MINIMAX_VIDEO_TASK_MISSING',
    );
  }

  return taskId;
};

const queryMiniMaxVideoTask = async (taskId: string) => {
  const url = new URL(env.minimaxVideoQueryUrl);
  url.searchParams.set('task_id', taskId);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.minimaxApiKey}`,
    },
    method: 'GET',
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `MiniMax video status query failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'MINIMAX_VIDEO_QUERY_FAILED',
    );
  }

  const payload = (await response.json()) as MiniMaxVideoQueryResponse;
  console.log('[minimax:video] Query response', payload);
  return payload;
};

const waitForMiniMaxVideo = async (taskId: string) => {
  for (let attempt = 0; attempt < env.minimaxVideoPollMaxAttempts; attempt += 1) {
    const payload = await queryMiniMaxVideoTask(taskId);
    const status = (payload.status ?? payload.data?.status ?? '').trim();
    const statusCode = payload.base_resp?.status_code;
    const statusMessage = payload.base_resp?.status_msg?.trim();

    if (typeof statusCode === 'number' && statusCode !== 0) {
      throw new AppError(
        `MiniMax video status query failed${statusMessage ? `: ${statusMessage}` : '.'}`,
        502,
        'MINIMAX_VIDEO_QUERY_FAILED',
      );
    }

    if (status === 'Success') {
      const fileId = normalizeId(payload.file_id ?? payload.data?.file_id);
      if (!fileId) {
        throw new AppError(
          'MiniMax video completed without a file id.',
          502,
          'MINIMAX_VIDEO_FILE_ID_MISSING',
        );
      }

      return fileId;
    }

    if (status === 'Fail') {
      throw new AppError('MiniMax video generation failed.', 502, 'MINIMAX_VIDEO_FAILED');
    }

    await sleep(env.minimaxVideoPollIntervalMs);
  }

  throw new AppError(
    'MiniMax video generation timed out while waiting for the preview clip.',
    504,
    'MINIMAX_VIDEO_TIMEOUT',
  );
};

const retrieveMiniMaxFile = async (fileId: string) => {
  const url = new URL(env.minimaxFileRetrieveUrl);
  url.searchParams.set('file_id', fileId);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.minimaxApiKey}`,
    },
    method: 'GET',
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `MiniMax file retrieval failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'MINIMAX_VIDEO_FILE_RETRIEVE_FAILED',
    );
  }

  const payload = (await response.json()) as MiniMaxFileRetrieveResponse;
  const downloadUrl = payload.file?.download_url;

  if (!downloadUrl) {
    throw new AppError(
      'MiniMax file retrieval did not return a download URL.',
      502,
      'MINIMAX_VIDEO_DOWNLOAD_URL_MISSING',
    );
  }

  return {
    downloadUrl,
    filename: payload.file?.filename ?? 'scene-video.mp4',
  };
};

const downloadSceneVideo = async ({
  downloadUrl,
  imageId,
  sceneIndex,
  sourcePrompt,
}: {
  downloadUrl: string;
  imageId: string;
  sceneIndex: number;
  sourcePrompt: string;
}) => {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `MiniMax video download failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'MINIMAX_VIDEO_DOWNLOAD_FAILED',
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const hash = crypto
    .createHash('sha1')
    .update(`${imageId}-${sceneIndex}-${sourcePrompt}`)
    .digest('hex')
    .slice(0, 16);
  const fileName = `scene-${sceneIndex + 1}-${hash}.mp4`;
  const filePath = path.join(generatedVideosDirectory, fileName);

  await fs.writeFile(filePath, Buffer.from(arrayBuffer));

  return `${env.publicBaseUrl.replace(/\/$/, '')}/generated-videos/${fileName}`;
};

export const generateSceneVideoPreview = async ({ image, sceneIndex }: SceneVideoRequest) => {
  if (!env.minimaxApiKey) {
    throw new AppError('MINIMAX_API_KEY is not configured.', 500, 'MINIMAX_API_KEY_MISSING');
  }

  if (!env.minimaxVideoEnabled) {
    throw new AppError('MiniMax scene video generation is disabled.', 400, 'MINIMAX_VIDEO_DISABLED');
  }

  const imageId = typeof image.id === 'string' && image.id.trim().length > 0 ? image.id : `img_${sceneIndex + 1}`;
  const sourceImageUrl =
    typeof image.sourceImageUrl === 'string' && image.sourceImageUrl.trim().length > 0
      ? image.sourceImageUrl.trim()
      : '';
  const imageUrl = typeof image.url === 'string' ? image.url.trim() : '';
  const videoPromptText = typeof image.videoPromptText === 'string' ? image.videoPromptText.trim() : '';
  const promptText = typeof image.promptText === 'string' ? image.promptText.trim() : '';

  if ((!sourceImageUrl && !imageUrl) || !videoPromptText) {
    throw new AppError(
      'Scene video generation requires both an image URL and an image-to-video prompt.',
      400,
      'SCENE_VIDEO_INPUT_INVALID',
    );
  }

  await ensureGeneratedVideosDirectory();
  const firstFrameImage = getFirstFrameImageUrl(sourceImageUrl || imageUrl);
  const taskId = await createMiniMaxVideoTask({
    firstFrameImage,
    prompt: buildImageToVideoPrompt(videoPromptText),
  });
  const fileId = await waitForMiniMaxVideo(taskId);
  const { downloadUrl } = await retrieveMiniMaxFile(fileId);
  const videoUrl = await downloadSceneVideo({
    downloadUrl,
    imageId,
    sceneIndex,
    sourcePrompt: videoPromptText,
  });

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
