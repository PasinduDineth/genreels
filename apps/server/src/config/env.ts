import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDirectory, '../../../../');

dotenv.config({ path: path.join(workspaceRoot, '.env') });
dotenv.config();

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const maskSecret = (value: string | null) => {
  if (!value) {
    return 'missing';
  }

  if (value.length <= 10) {
    return `${value.slice(0, 2)}...${value.slice(-2)}`;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

export const env = {
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  minimaxApiKey: process.env.MINIMAX_API_KEY?.trim() || null,
  minimaxImageBaseUrl:
    process.env.MINIMAX_IMAGE_BASE_URL ?? 'https://api.minimax.io/v1/image_generation',
  minimaxImageModel: process.env.MINIMAX_IMAGE_MODEL ?? 'image-01',
  minimaxFileRetrieveUrl:
    process.env.MINIMAX_FILE_RETRIEVE_URL ?? 'https://api.minimax.io/v1/files/retrieve',
  minimaxSpeechBaseUrl:
    process.env.MINIMAX_SPEECH_BASE_URL ?? 'https://api.minimax.io/v1/t2a_v2',
  minimaxSpeechModel: process.env.MINIMAX_SPEECH_MODEL ?? 'speech-02-turbo',
  minimaxSpeechVoiceId:
    process.env.MINIMAX_SPEECH_VOICE_ID ?? 'ttv-voice-2025062518302725-Nrot8sG4',
  minimaxSpeechAudioFormat: process.env.MINIMAX_SPEECH_AUDIO_FORMAT ?? 'mp3',
  minimaxSpeechBitrate: toNumber(process.env.MINIMAX_SPEECH_BITRATE, 128000),
  minimaxSpeechChannelCount: toNumber(process.env.MINIMAX_SPEECH_CHANNEL_COUNT, 1),
  minimaxSpeechSampleRate: toNumber(process.env.MINIMAX_SPEECH_SAMPLE_RATE, 32000),
  minimaxTextBaseUrl:
    process.env.MINIMAX_TEXT_BASE_URL ?? 'https://api.minimax.io/anthropic/v1/messages',
  minimaxNarrativeModel: process.env.MINIMAX_NARRATIVE_MODEL ?? 'MiniMax-M2.7',
  minimaxPromptModel: process.env.MINIMAX_PROMPT_MODEL ?? 'MiniMax-M2.7',
  minimaxVideoBaseUrl:
    process.env.MINIMAX_VIDEO_BASE_URL ?? 'https://api.minimax.io/v1/video_generation',
  minimaxVideoEnabled: process.env.MINIMAX_VIDEO_ENABLED !== 'false',
  minimaxVideoModel: process.env.MINIMAX_VIDEO_MODEL ?? 'MiniMax-Hailuo-2.3',
  minimaxVideoPollIntervalMs: toNumber(process.env.MINIMAX_VIDEO_POLL_INTERVAL_MS, 5000),
  minimaxVideoPollMaxAttempts: toNumber(process.env.MINIMAX_VIDEO_POLL_MAX_ATTEMPTS, 40),
  minimaxVideoQueryUrl:
    process.env.MINIMAX_VIDEO_QUERY_URL ?? 'https://api.minimax.io/v1/query/video_generation',
  minimaxVideoResolution: process.env.MINIMAX_VIDEO_RESOLUTION ?? '768P',
  minimaxVideoDurationSeconds: toNumber(process.env.MINIMAX_VIDEO_DURATION_SECONDS, 6),
  openRouterApiKey: process.env.OPENROUTER_API_KEY?.trim() || null,
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  openRouterNarrativeModel:
    process.env.OPENROUTER_NARRATIVE_MODEL ?? 'google/gemma-4-26b-a4b-it:free',
  openRouterPromptModel:
    process.env.OPENROUTER_PROMPT_MODEL ?? 'google/gemma-4-26b-a4b-it:free',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000',
  port: toNumber(process.env.PORT, 4000),
} as const;

console.log('[env] Loaded server environment', {
  workspaceRoot,
  minimaxApiKeyPreview: maskSecret(env.minimaxApiKey),
  minimaxApiKeyLength: env.minimaxApiKey?.length ?? 0,
  minimaxTextBaseUrl: env.minimaxTextBaseUrl,
  minimaxNarrativeModel: env.minimaxNarrativeModel,
  minimaxPromptModel: env.minimaxPromptModel,
  minimaxImageBaseUrl: env.minimaxImageBaseUrl,
  minimaxImageModel: env.minimaxImageModel,
  minimaxSpeechBaseUrl: env.minimaxSpeechBaseUrl,
  minimaxSpeechModel: env.minimaxSpeechModel,
  minimaxSpeechVoiceId: env.minimaxSpeechVoiceId,
  minimaxSpeechAudioFormat: env.minimaxSpeechAudioFormat,
  minimaxSpeechBitrate: env.minimaxSpeechBitrate,
  minimaxSpeechChannelCount: env.minimaxSpeechChannelCount,
  minimaxSpeechSampleRate: env.minimaxSpeechSampleRate,
  minimaxVideoBaseUrl: env.minimaxVideoBaseUrl,
  minimaxVideoQueryUrl: env.minimaxVideoQueryUrl,
  minimaxFileRetrieveUrl: env.minimaxFileRetrieveUrl,
  minimaxVideoModel: env.minimaxVideoModel,
  minimaxVideoResolution: env.minimaxVideoResolution,
  minimaxVideoDurationSeconds: env.minimaxVideoDurationSeconds,
  minimaxVideoEnabled: env.minimaxVideoEnabled,
});
