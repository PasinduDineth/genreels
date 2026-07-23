import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Caption } from '@remotion/captions';
import { parseBuffer } from 'music-metadata';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { transcribeNarrationAudio } from './whisper.service.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const generatedAudioDirectory = path.resolve(currentDirectory, '../../../../../generated-audio');

const extensionFromContentType = (contentType: string) => {
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('webm')) return 'webm';
  return 'mp3';
};

const sanitizeSegment = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'narration';

export const saveNarrationAudio = async ({
  audioBuffer,
  contentType,
  topic,
}: {
  audioBuffer: Buffer;
  contentType: string;
  topic: string;
}): Promise<{
  audioDurationInSeconds?: number;
  audioUrl: string;
  captions: Caption[];
  fileName: string;
}> => {
  await fs.mkdir(generatedAudioDirectory, { recursive: true });

  const extension = extensionFromContentType(contentType);
  const hash = crypto.createHash('sha1').update(audioBuffer).digest('hex').slice(0, 16);
  const fileName = `${sanitizeSegment(topic)}-${hash}.${extension}`;
  const filePath = path.join(generatedAudioDirectory, fileName);
  const captionPath = path.join(generatedAudioDirectory, `${sanitizeSegment(topic)}-${hash}.captions.json`);

  await fs.writeFile(filePath, audioBuffer);
  const captions = await transcribeNarrationAudio({ audioPath: filePath, captionOutputPath: captionPath });
  const audioMetadata = await parseBuffer(audioBuffer, { mimeType: contentType });
  const audioDurationInSeconds =
    typeof audioMetadata.format.duration === 'number' && Number.isFinite(audioMetadata.format.duration)
      ? audioMetadata.format.duration
      : undefined;

  return {
    audioDurationInSeconds,
    audioUrl: `${env.runpodGatewayBaseUrl.replace(/\/$/, '')}/generated-audio/${fileName}`,
    captions,
    fileName,
  };
};

type RunpodSpeechResponse = {
  audio?: string;
  data?: { audio?: string };
};

const normalizeAudioBytes = (payload: RunpodSpeechResponse) => {
  const audio = typeof payload.audio === 'string' ? payload.audio.trim() : '';
  const nested = typeof payload.data?.audio === 'string' ? payload.data.audio.trim() : '';
  const value = audio || nested;
  if (!value) return null;
  return Buffer.from(value, /^[0-9a-fA-F]+$/.test(value) ? 'hex' : 'base64');
};

const requestRunpodSpeech = async (text: string) => {
  const url = `${env.runpodGatewayBaseUrl.replace(/\/$/, '')}/v1/audio/speech`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: env.ttsVoiceName,
      input: text,
      response_format: env.minimaxSpeechAudioFormat === 'wav' ? 'wav' : 'mp3',
      speed: 1,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `Runpod speech request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'RUNPOD_SPEECH_CREATE_FAILED',
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('audio/')) {
    return Buffer.from(await response.arrayBuffer());
  }

  const payload = (await response.json()) as RunpodSpeechResponse;
  const audioBuffer = normalizeAudioBytes(payload);
  if (!audioBuffer) {
    throw new AppError('Runpod speech request did not return audio data.', 502, 'RUNPOD_SPEECH_AUDIO_MISSING');
  }

  return audioBuffer;
};

export const generateNarrationAudio = async ({ text, topic }: { text: string; topic: string }) => {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new AppError('Narration text is required.', 400, 'NARRATION_TEXT_REQUIRED');
  }

  const audioBuffer = await requestRunpodSpeech(normalizedText);
  const extension = env.minimaxSpeechAudioFormat;
  const contentType = extension === 'wav' ? 'audio/wav' : extension === 'ogg' ? 'audio/ogg' : 'audio/mpeg';

  return saveNarrationAudio({ audioBuffer, contentType, topic });
};
