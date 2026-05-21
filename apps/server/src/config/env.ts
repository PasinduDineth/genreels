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
  minimaxTextBaseUrl:
    process.env.MINIMAX_TEXT_BASE_URL ?? 'https://api.minimax.io/anthropic/v1/messages',
  minimaxNarrativeModel: process.env.MINIMAX_NARRATIVE_MODEL ?? 'MiniMax-M2.7',
  minimaxPromptModel: process.env.MINIMAX_PROMPT_MODEL ?? 'MiniMax-M2.7',
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
});
