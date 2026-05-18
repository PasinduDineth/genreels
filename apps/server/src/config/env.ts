import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  openRouterApiKey: process.env.OPENROUTER_API_KEY?.trim() || null,
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  openRouterNarrativeModel:
    process.env.OPENROUTER_NARRATIVE_MODEL ?? 'google/gemma-4-26b-a4b-it:free',
  openRouterPromptModel:
    process.env.OPENROUTER_PROMPT_MODEL ?? 'google/gemma-4-26b-a4b-it:free',
  pollinationsImageBaseUrl: process.env.POLLINATIONS_IMAGE_BASE_URL ?? 'https://image.pollinations.ai/prompt',
  pollinationsImageModel: process.env.POLLINATIONS_IMAGE_MODEL ?? 'flux',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000',
  port: toNumber(process.env.PORT, 4000),
} as const;
