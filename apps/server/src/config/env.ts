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

const port = toNumber(process.env.PORT, 4000);

export const env = {
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`,
  runpodGatewayBaseUrl: process.env.RUNPOD_GATEWAY_BASE_URL ?? 'http://127.0.0.1:8000',
  runpodLlmModel: process.env.RUNPOD_LLM_MODEL ?? 'qwen3:32b',
  runpodTtsModel: process.env.RUNPOD_TTS_MODEL ?? 'tts-1',
  runpodTtsVoiceName: process.env.RUNPOD_TTS_VOICE_NAME ?? 'Ryan',
  runpodVideoPollIntervalMs: toNumber(process.env.RUNPOD_VIDEO_POLL_INTERVAL_MS, 5000),
  runpodVideoPollMaxAttempts: toNumber(process.env.RUNPOD_VIDEO_POLL_MAX_ATTEMPTS, 240),
  runpodVideoDurationSeconds: toNumber(process.env.RUNPOD_VIDEO_DURATION_SECONDS, 6),
  port,
} as const;

console.log('[env] Loaded RunPod server environment', {
  workspaceRoot,
  publicBaseUrl: env.publicBaseUrl,
  runpodGatewayBaseUrl: env.runpodGatewayBaseUrl,
  runpodLlmModel: env.runpodLlmModel,
  runpodTtsModel: env.runpodTtsModel,
  runpodTtsVoiceName: env.runpodTtsVoiceName,
  runpodVideoDurationSeconds: env.runpodVideoDurationSeconds,
});
