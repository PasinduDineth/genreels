import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { appendPromptConstraintSuffix, normalizePromptScene } from '../prompts/prompt-constraints.js';
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

const extensionFromContentType = (contentType: string | null) => {
  if (!contentType) {
    return 'jpg';
  }

  if (contentType.includes('png')) {
    return 'png';
  }

  if (contentType.includes('webp')) {
    return 'webp';
  }

  return 'jpg';
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
      response_format: 'base64',
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
  const base64Images = parseMiniMaxImageBase64s(payload);
  console.log('[minimax:image] Parsed response', {
    promptIndex: index,
    imageCount: base64Images.length,
  });

  if (base64Images.length === 0) {
    throw new AppError(
      'MiniMax returned no image data.',
      502,
      'MINIMAX_IMAGE_EMPTY',
    );
  }

  const imageBuffer = Buffer.from(base64Images[0], 'base64');
  const hash = crypto
    .createHash('sha1')
    .update(`${index}-${prompt}`)
    .digest('hex')
    .slice(0, 16);
  const fileName = `img-${index + 1}-${hash}.jpg`;
  const filePath = path.join(generatedImagesDirectory, fileName);

  await fs.writeFile(filePath, imageBuffer);

  return `${env.publicBaseUrl.replace(/\/$/, '')}/generated-images/${fileName}`;
};

export const generateImagesFromPrompts = async (prompts: unknown[]) => {
  const normalizedPrompts = prompts
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .slice(0, TARGET_PROMPT_COUNT)
    .map(normalizePromptScene);

  if (normalizedPrompts.length === 0) {
    throw new AppError('At least one prompt is required to generate images.', 400, 'PROMPTS_REQUIRED');
  }

  await ensureGeneratedImagesDirectory();
  const finalImagePrompts = normalizedPrompts.map(appendPromptConstraintSuffix);

  const imageUrls: string[] = [];
  for (const [index, prompt] of finalImagePrompts.entries()) {
    imageUrls.push(await generateMiniMaxImage(prompt, index));
  }

  const images = normalizedPrompts.map((prompt, index) => ({
    id: `img_${index + 1}`,
    promptId: `prompt_${index + 1}`,
    promptText: prompt,
    url: imageUrls[index],
  }));

  return {
    images,
  };
};
