import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { normalizePromptScene } from '../prompts/prompt-constraints.js';
import { pollinationsClient } from '../pollinations/pollinations.client.js';
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

const fetchAndCacheImage = async (prompt: string, index: number) => {
  const upstreamUrl = pollinationsClient.buildImageRequest(prompt).imageUrl;
  const response = await fetch(upstreamUrl, {
    headers: {
      Accept: 'image/*',
    },
  });

  if (!response.ok) {
    throw new AppError(
      `Pollinations image request failed with status ${response.status}.`,
      502,
      'IMAGE_FETCH_FAILED',
    );
  }

  const contentType = response.headers.get('content-type');
  const extension = extensionFromContentType(contentType);
  const hash = crypto
    .createHash('sha1')
    .update(`${index}-${prompt}`)
    .digest('hex')
    .slice(0, 16);
  const fileName = `img-${index + 1}-${hash}.${extension}`;
  const filePath = path.join(generatedImagesDirectory, fileName);
  const arrayBuffer = await response.arrayBuffer();

  await fs.writeFile(filePath, Buffer.from(arrayBuffer));

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

  const imageUrls: string[] = [];
  for (const [index, prompt] of normalizedPrompts.entries()) {
    imageUrls.push(await fetchAndCacheImage(prompt, index));
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
