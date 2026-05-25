import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { buildTextToImagePrompt, normalizePromptScene } from '../prompts/prompt-constraints.js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGET_PROMPT_COUNT = 10;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const generatedImagesDirectory = path.resolve(currentDirectory, '../../../../../generated-images');

const ensureGeneratedImagesDirectory = async () => {
  await fs.mkdir(generatedImagesDirectory, { recursive: true });
};

type PromptInput = {
  id?: unknown;
  text?: unknown;
  videoPrompt?: unknown;
};

type MiniMaxImagePayload = {
  data?: {
    image_base64?: unknown;
    image_urls?: unknown;
  } | unknown[];
};

const getMiniMaxImageBase64 = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const maybeRecord = data as {
    image_base64?: unknown;
    image_url?: unknown;
  };

  if (typeof maybeRecord.image_base64 === 'string' && maybeRecord.image_base64.trim().length > 0) {
    return maybeRecord.image_base64;
  }

  return null;
};

const parseMiniMaxImageBase64s = (payload: unknown): string[] => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const response = payload as {
    data?: unknown;
  };

  if (Array.isArray(response.data)) {
    return response.data
      .map((entry) => getMiniMaxImageBase64(entry))
      .filter((value): value is string => Boolean(value));
  }

  if (response.data && typeof response.data === 'object') {
    const dataRecord = response.data as {
      image_base64?: unknown;
    };

    if (Array.isArray(dataRecord.image_base64)) {
      return dataRecord.image_base64.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      );
    }

    const image = getMiniMaxImageBase64(response.data);
    return image ? [image] : [];
  }

  return [];
};

const parseMiniMaxImageUrls = (payload: unknown): string[] => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const response = payload as MiniMaxImagePayload;
  if (Array.isArray(response.data)) {
    return response.data
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const value = entry as { image_url?: unknown };
        return typeof value.image_url === 'string' && value.image_url.trim().length > 0
          ? value.image_url.trim()
          : null;
      })
      .filter((value): value is string => Boolean(value));
  }

  if (response.data && typeof response.data === 'object') {
    const dataRecord = response.data as { image_urls?: unknown };
    if (Array.isArray(dataRecord.image_urls)) {
      return dataRecord.image_urls.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      );
    }
  }

  return [];
};

const extensionFromRemoteUrl = (imageUrl: string) => {
  try {
    const parsed = new URL(imageUrl);
    const extension = path.extname(parsed.pathname).replace('.', '').toLowerCase();
    if (extension === 'png' || extension === 'webp' || extension === 'jpeg' || extension === 'jpg') {
      return extension === 'jpeg' ? 'jpg' : extension;
    }
  } catch {
    // fall back to jpg
  }

  return 'jpg';
};

const generateMiniMaxImage = async (prompt: string, index: number) => {
  if (!env.minimaxApiKey) {
    throw new AppError('MINIMAX_API_KEY is not configured.', 500, 'MINIMAX_API_KEY_MISSING');
  }

  console.log('[minimax:image] Sending request', {
    url: env.minimaxImageBaseUrl,
    model: env.minimaxImageModel,
    promptIndex: index,
    promptLength: prompt.length,
    apiKeyLength: env.minimaxApiKey.length,
    apiKeyPrefix: env.minimaxApiKey.slice(0, 6),
    apiKeySuffix: env.minimaxApiKey.slice(-4),
  });

  const response = await fetch(env.minimaxImageBaseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.minimaxApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.minimaxImageModel,
      prompt,
      aspect_ratio: '9:16',
      response_format: 'url',
      n: 1,
      prompt_optimizer: true,
    }),
  });

  console.log('[minimax:image] Received response', {
    promptIndex: index,
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    console.error('[minimax:image] Error body', bodyText);
    throw new AppError(
      `MiniMax image request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'MINIMAX_IMAGE_FAILED',
    );
  }

  const payload = (await response.json()) as unknown;
  console.log('[minimax:image] Raw response', payload);
  const imageUrls = parseMiniMaxImageUrls(payload);
  console.log('[minimax:image] Parsed response', {
    promptIndex: index,
    imageCount: imageUrls.length,
  });

  if (imageUrls.length === 0) {
    throw new AppError(
      'MiniMax returned no image data.',
      502,
      'MINIMAX_IMAGE_EMPTY',
    );
  }

  const sourceImageUrl = imageUrls[0];
  const remoteResponse = await fetch(sourceImageUrl);
  if (!remoteResponse.ok) {
    const bodyText = await remoteResponse.text();
    throw new AppError(
      `MiniMax image download failed with status ${remoteResponse.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'MINIMAX_IMAGE_DOWNLOAD_FAILED',
    );
  }

  const imageBuffer = Buffer.from(await remoteResponse.arrayBuffer());
  const hash = crypto
    .createHash('sha1')
    .update(`${index}-${prompt}`)
    .digest('hex')
    .slice(0, 16);
  const fileName = `img-${index + 1}-${hash}.${extensionFromRemoteUrl(sourceImageUrl)}`;
  const filePath = path.join(generatedImagesDirectory, fileName);

  await fs.writeFile(filePath, imageBuffer);

  return {
    sourceImageUrl,
    url: `${env.publicBaseUrl.replace(/\/$/, '')}/generated-images/${fileName}`,
  };
};

export const generateImagesFromPrompts = async (prompts: unknown[]) => {
  const normalizedPrompts = prompts
    .filter((value): value is PromptInput => typeof value === 'object' && value !== null)
    .slice(0, TARGET_PROMPT_COUNT)
    .map((value, index) => ({
      id:
        typeof value.id === 'string' && value.id.trim().length > 0
          ? value.id
          : `prompt_${index + 1}`,
      text: normalizePromptScene(typeof value.text === 'string' ? value.text : ''),
      videoPrompt:
        typeof value.videoPrompt === 'string' && value.videoPrompt.trim().length > 0
          ? value.videoPrompt.trim()
          : undefined,
    }))
    .filter((value) => value.text.length > 0);

  if (normalizedPrompts.length === 0) {
    throw new AppError('At least one prompt is required to generate images.', 400, 'PROMPTS_REQUIRED');
  }

  const promptsForImageGeneration = normalizedPrompts.slice(0, TARGET_PROMPT_COUNT);

  await ensureGeneratedImagesDirectory();
  const finalImagePrompts = promptsForImageGeneration.map((prompt, index) =>
    index === 0 ? buildTextToImagePrompt(prompt.text) : prompt.text,
  );

  const imageAssets: Array<{ sourceImageUrl: string; url: string }> = [];
  for (const [index, prompt] of finalImagePrompts.entries()) {
    imageAssets.push(await generateMiniMaxImage(prompt, index));
  }

  const images = promptsForImageGeneration.map((prompt, index) => ({
    id: `img_${index + 1}`,
    promptId: prompt.id,
    promptText: prompt.text,
    sourceImageUrl: imageAssets[index]?.sourceImageUrl,
    url: imageAssets[index]?.url,
    videoPromptText: prompt.videoPrompt,
  }));

  return {
    images,
  };
};
