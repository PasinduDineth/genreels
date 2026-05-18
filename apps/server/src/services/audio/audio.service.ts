import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const generatedAudioDirectory = path.resolve(currentDirectory, '../../../../../generated-audio');

const extensionFromContentType = (contentType: string) => {
  if (contentType.includes('wav')) {
    return 'wav';
  }

  if (contentType.includes('ogg')) {
    return 'ogg';
  }

  if (contentType.includes('webm')) {
    return 'webm';
  }

  return 'mp3';
};

const sanitizeSegment = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'narration';
};

export const saveNarrationAudio = async ({
  audioBuffer,
  contentType,
  topic,
}: {
  audioBuffer: Buffer;
  contentType: string;
  topic: string;
}) => {
  await fs.mkdir(generatedAudioDirectory, { recursive: true });

  const extension = extensionFromContentType(contentType);
  const hash = crypto.createHash('sha1').update(audioBuffer).digest('hex').slice(0, 16);
  const fileName = `${sanitizeSegment(topic)}-${hash}.${extension}`;
  const filePath = path.join(generatedAudioDirectory, fileName);

  await fs.writeFile(filePath, audioBuffer);

  return {
    audioUrl: `${env.publicBaseUrl.replace(/\/$/, '')}/generated-audio/${fileName}`,
    fileName,
  };
};
