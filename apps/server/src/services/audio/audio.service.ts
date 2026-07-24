import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Caption } from '@remotion/captions';
import { parseBuffer } from 'music-metadata';
import { env } from '../../config/env.js';
import { getRunpodGatewayBaseUrl } from '../../config/runpod-gateway.js';
import { getMediaPublicUrl } from '../../config/media-url.js';
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
    audioUrl: getMediaPublicUrl(`generated-audio/${fileName}`),
    captions,
    fileName,
  };
};

type RunpodSpeechResponse = {
  audio?: string;
  data?: { audio?: string };
};

const MAX_TTS_CHUNK_CHARACTERS = 240;
const MAX_TTS_ATTEMPTS = 2;

const splitNarrationForTts = (text: string) => {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
  const chunks: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length <= MAX_TTS_CHUNK_CHARACTERS) {
      chunks.push(sentence);
      continue;
    }

    const words = sentence.split(/\s+/);
    let chunk = '';
    for (const word of words) {
      const candidate = chunk ? `${chunk} ${word}` : word;
      if (candidate.length > MAX_TTS_CHUNK_CHARACTERS && chunk) {
        chunks.push(chunk);
        chunk = word;
      } else {
        chunk = candidate;
      }
    }
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
};

const normalizeAudioBytes = (payload: RunpodSpeechResponse) => {
  const audio = typeof payload.audio === 'string' ? payload.audio.trim() : '';
  const nested = typeof payload.data?.audio === 'string' ? payload.data.audio.trim() : '';
  const value = audio || nested;
  if (!value) return null;
  return Buffer.from(value, /^[0-9a-fA-F]+$/.test(value) ? 'hex' : 'base64');
};

const getWavDataChunk = (buffer: Buffer) => {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new AppError('RunPod TTS returned an invalid WAV file.', 502, 'RUNPOD_SPEECH_WAV_INVALID');
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkSize;

    if (dataEnd > buffer.length) {
      throw new AppError('RunPod TTS returned a truncated WAV file.', 502, 'RUNPOD_SPEECH_WAV_INVALID');
    }
    if (chunkId === 'data') {
      return {
        data: buffer.subarray(dataStart, dataEnd),
        dataSizeOffset: offset + 4,
        header: buffer.subarray(0, dataStart),
      };
    }

    offset = dataEnd + (chunkSize % 2);
  }

  throw new AppError('RunPod TTS WAV file has no audio data chunk.', 502, 'RUNPOD_SPEECH_WAV_INVALID');
};

export const mergeWavBuffers = (buffers: Buffer[]) => {
  if (buffers.length === 0) {
    throw new AppError('RunPod TTS returned no audio chunks.', 502, 'RUNPOD_SPEECH_AUDIO_MISSING');
  }

  const chunks = buffers.map(getWavDataChunk);
  const referenceHeader = chunks[0].header;
  const dataSizeOffset = chunks[0].dataSizeOffset;

  for (const chunk of chunks.slice(1)) {
    if (!chunk.header.equals(referenceHeader)) {
      const referenceFormat = referenceHeader.subarray(12, dataSizeOffset - 4);
      const chunkFormat = chunk.header.subarray(12, chunk.dataSizeOffset - 4);
      if (!chunkFormat.equals(referenceFormat)) {
        throw new AppError('RunPod TTS returned incompatible WAV chunks.', 502, 'RUNPOD_SPEECH_WAV_INCOMPATIBLE');
      }
    }
  }

  const audioData = Buffer.concat(chunks.map((chunk) => chunk.data));
  const header = Buffer.from(referenceHeader);
  header.writeUInt32LE(audioData.length, dataSizeOffset);
  header.writeUInt32LE(header.length + audioData.length - 8, 4);
  return Buffer.concat([header, audioData]);
};

const requestRunpodSpeechChunk = async (text: string, chunkIndex: number) => {
  const url = `${getRunpodGatewayBaseUrl()}/v1/audio/speech`;
  for (let attempt = 1; attempt <= MAX_TTS_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.runpodTtsModel,
        voice: env.runpodTtsVoiceName,
        input: text,
        response_format: 'wav',
        speed: 1,
      }),
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('audio/')) {
        return Buffer.from(await response.arrayBuffer());
      }

      const payload = (await response.json()) as RunpodSpeechResponse;
      const audioBuffer = normalizeAudioBytes(payload);
      if (audioBuffer) {
        return audioBuffer;
      }
      throw new AppError('RunPod speech request did not return audio data.', 502, 'RUNPOD_SPEECH_AUDIO_MISSING');
    }

    const bodyText = await response.text();
    const retryable = response.status === 502 || response.status === 503 || response.status === 504;
    if (!retryable || attempt === MAX_TTS_ATTEMPTS) {
      throw new AppError(
        `RunPod speech chunk ${chunkIndex + 1} failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
        502,
        'RUNPOD_SPEECH_CREATE_FAILED',
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new AppError('RunPod speech generation failed unexpectedly.', 502, 'RUNPOD_SPEECH_CREATE_FAILED');
};

const requestRunpodSpeech = async (text: string) => {
  const chunks = splitNarrationForTts(text);
  const audioChunks: Buffer[] = [];

  for (const [chunkIndex, chunk] of chunks.entries()) {
    audioChunks.push(await requestRunpodSpeechChunk(chunk, chunkIndex));
  }

  return mergeWavBuffers(audioChunks);
};

export const generateNarrationAudio = async ({ text, topic }: { text: string; topic: string }) => {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new AppError('Narration text is required.', 400, 'NARRATION_TEXT_REQUIRED');
  }

  const audioBuffer = await requestRunpodSpeech(normalizedText);
  return saveNarrationAudio({ audioBuffer, contentType: 'audio/wav', topic });
};
