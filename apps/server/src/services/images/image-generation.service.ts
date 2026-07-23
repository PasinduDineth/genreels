import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { buildTextToImagePrompt, normalizePromptScene } from '../prompts/prompt-constraints.js';

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

const extensionFromRemoteUrl = (imageUrl: string) => {
  try {
    const parsed = new URL(imageUrl);
    const extension = path.extname(parsed.pathname).replace('.', '').toLowerCase();
    if (extension === 'png' || extension === 'webp' || extension === 'jpeg' || extension === 'jpg') {
      return extension === 'jpeg' ? 'jpg' : extension;
    }
  } catch {}
  return 'jpg';
};

const resolveRemoteUrl = (value: string) => {
  if (/^https?:/i.test(value)) return value;
  return new URL(value, env.runpodGatewayBaseUrl).toString();
};

const generateRunpodImage = async (prompt: string, index: number) => {
  const response = await fetch(`${env.runpodGatewayBaseUrl.replace(/\/$/, '')}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      width: 1024,
      height: 1920,
      steps: 30,
      guidance_scale: 7,
      seed: index + 1,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `Runpod image request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'RUNPOD_IMAGE_FAILED',
    );
  }

  const payload = (await response.json()) as { data?: Array<{ url?: string }> };
  const imageUrl = payload.data?.[0]?.url;
  if (!imageUrl) {
    throw new AppError('Runpod returned no image URL.', 502, 'RUNPOD_IMAGE_EMPTY');
  }

  const sourceImageUrl = resolveRemoteUrl(imageUrl);
  const remoteResponse = await fetch(sourceImageUrl);
  if (!remoteResponse.ok) {
    const bodyText = await remoteResponse.text();
    throw new AppError(
      `Runpod image download failed with status ${remoteResponse.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'RUNPOD_IMAGE_DOWNLOAD_FAILED',
    );
  }

  const imageBuffer = Buffer.from(await remoteResponse.arrayBuffer());
  const hash = crypto.createHash('sha1').update(`${index}-${prompt}`).digest('hex').slice(0, 16);
  const fileName = `img-${index + 1}-${hash}.${extensionFromRemoteUrl(sourceImageUrl)}`;
  const filePath = path.join(generatedImagesDirectory, fileName);
  await fs.writeFile(filePath, imageBuffer);

  return {
    sourceImageUrl,
    url: `${env.runpodGatewayBaseUrl.replace(/\/$/, '')}/generated-images/${fileName}`,
  };
};

export const generateImagesFromPrompts = async (prompts: unknown[]) => {
  const normalizedPrompts = prompts
    .filter((value): value is PromptInput => typeof value === 'object' && value !== null)
    .slice(0, TARGET_PROMPT_COUNT)
    .map((value, index) => ({
      id: typeof value.id === 'string' && value.id.trim().length > 0 ? value.id : `prompt_${index + 1}`,
      text: normalizePromptScene(typeof value.text === 'string' ? value.text : ''),
      videoPrompt: typeof value.videoPrompt === 'string' && value.videoPrompt.trim().length > 0 ? value.videoPrompt.trim() : undefined,
    }))
    .filter((value) => value.text.length > 0);

  if (normalizedPrompts.length === 0) {
    throw new AppError('At least one prompt is required to generate images.', 400, 'PROMPTS_REQUIRED');
  }

  await ensureGeneratedImagesDirectory();
  const finalImagePrompts = normalizedPrompts.map((prompt, index) =>
    index === 0 ? buildTextToImagePrompt(prompt.text) : prompt.text,
  );

  const imageAssets: Array<{ sourceImageUrl: string; url: string }> = [];
  for (const [index, prompt] of finalImagePrompts.entries()) {
    imageAssets.push(await generateRunpodImage(prompt, index));
  }

  const images = normalizedPrompts.map((prompt, index) => ({
    id: `img_${index + 1}`,
    promptId: prompt.id,
    promptText: prompt.text,
    sourceImageUrl: imageAssets[index]?.sourceImageUrl,
    url: imageAssets[index]?.url,
    videoPromptText: prompt.videoPrompt,
  }));

  return { images };
};
