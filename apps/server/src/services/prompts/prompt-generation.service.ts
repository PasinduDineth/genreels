import { AppError } from '../../lib/app-error.js';
import { pollinationsClient } from '../pollinations/pollinations.client.js';
import {
  getPromptConstraintSuffix,
  normalizePromptScene,
  splitPromptCandidates,
} from './prompt-constraints.js';

const TARGET_PROMPT_COUNT = 10;

const ensureTopic = (topic: string) => {
  const normalized = topic.trim();

  if (!normalized) {
    throw new AppError('A topic is required to generate prompts.', 400, 'TOPIC_REQUIRED');
  }

  return normalized;
};

const createFallbackPrompt = (topic: string, index: number) => {
  return normalizePromptScene(
    `Scene ${index + 1} for ${topic}: a tense and mysterious historical moment frozen at the peak of suspense, ${getPromptConstraintSuffix()}`,
  );
};

const dedupePrompts = (prompts: string[]) => {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const prompt of prompts) {
    const key = prompt.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(prompt);
  }

  return results;
};

const enforcePromptCount = (topic: string, prompts: string[]) => {
  const results = [...prompts];

  while (results.length < TARGET_PROMPT_COUNT) {
    results.push(createFallbackPrompt(topic, results.length));
  }

  return results.slice(0, TARGET_PROMPT_COUNT);
};

export const normalizePromptPack = (topic: string, rawText: string) => {
  const candidates = splitPromptCandidates(rawText);
  const normalized = candidates.map(normalizePromptScene);
  const unique = dedupePrompts(normalized);
  return enforcePromptCount(topic, unique);
};

type GeneratePromptPackInput = {
  narrative: string;
  topic: string;
};

export const generatePromptPack = async ({ narrative, topic }: GeneratePromptPackInput) => {
  const normalizedTopic = ensureTopic(topic);
  const normalizedNarrative = narrative.trim();
  const rawText = await pollinationsClient.generatePromptText({
    narrative: normalizedNarrative,
    topic: normalizedTopic,
  });
  const prompts = normalizePromptPack(normalizedTopic, rawText);

  return {
    narrative: normalizedNarrative,
    topic: normalizedTopic,
    promptCount: prompts.length,
    prompts,
    rawResponse: rawText,
  };
};
