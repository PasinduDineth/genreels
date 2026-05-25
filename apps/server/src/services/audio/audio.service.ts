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
  const captions = await transcribeNarrationAudio({
    audioPath: filePath,
    captionOutputPath: captionPath,
  });
  const audioMetadata = await parseBuffer(audioBuffer, { mimeType: contentType });
  const audioDurationInSeconds =
    typeof audioMetadata.format.duration === 'number' && Number.isFinite(audioMetadata.format.duration)
      ? audioMetadata.format.duration
      : undefined;

  return {
    audioDurationInSeconds,
    audioUrl: `${env.publicBaseUrl.replace(/\/$/, '')}/generated-audio/${fileName}`,
    captions,
    fileName,
  };
};

type MiniMaxSpeechResponse = {
  data?: {
    audio?: string;
    status?: number;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  extra_info?: {
    audio_length?: number;
    audio_sample_rate?: number;
    audio_size?: number;
    bitrate?: number;
  };
};

const requestMiniMaxSpeech = async (text: string) => {
  if (!env.minimaxApiKey) {
    throw new AppError('MINIMAX_API_KEY is not configured.', 500, 'MINIMAX_API_KEY_MISSING');
  }

  const response = await fetch(env.minimaxSpeechBaseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.minimaxApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_setting: {
        bitrate: env.minimaxSpeechBitrate,
        channel: env.minimaxSpeechChannelCount,
        format: env.minimaxSpeechAudioFormat,
        sample_rate: env.minimaxSpeechSampleRate,
      },
      language_boost: 'auto',
      model: env.minimaxSpeechModel,
      output_format: 'hex',
      stream: false,
      text,
      voice_setting: {
        pitch: 0,
        speed: 1,
        voice_id: env.minimaxSpeechVoiceId,
        vol: 1,
      },
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `MiniMax speech request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'MINIMAX_SPEECH_CREATE_FAILED',
    );
  }

  const payload = (await response.json()) as MiniMaxSpeechResponse;
  console.log('[minimax:speech] Response', payload);

  const statusCode = payload.base_resp?.status_code;
  const statusMessage = payload.base_resp?.status_msg?.trim();
  if (typeof statusCode === 'number' && statusCode !== 0) {
    throw new AppError(
      `MiniMax speech request failed${statusMessage ? `: ${statusMessage}` : '.'}`,
      502,
      'MINIMAX_SPEECH_CREATE_FAILED',
    );
  }

  const audioHex = typeof payload.data?.audio === 'string' ? payload.data.audio.trim() : '';
  if (!audioHex) {
    throw new AppError(
      `MiniMax speech request did not return audio data${statusMessage ? `: ${statusMessage}` : '.'}`,
      502,
      'MINIMAX_SPEECH_AUDIO_MISSING',
    );
  }

  return Buffer.from(audioHex, 'hex');
};

export const generateNarrationAudio = async ({
  text,
  topic,
}: {
  text: string;
  topic: string;
}) => {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new AppError('Narration text is required.', 400, 'NARRATION_TEXT_REQUIRED');
  }

  const audioBuffer = await requestMiniMaxSpeech(normalizedText);
  const extension = env.minimaxSpeechAudioFormat;
  const contentType = extension === 'wav' ? 'audio/wav' : extension === 'ogg' ? 'audio/ogg' : 'audio/mpeg';

  return saveNarrationAudio({
    audioBuffer,
    contentType,
    topic,
  });
};
