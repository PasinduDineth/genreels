import { AppError } from '../../lib/app-error.js';
import { pollinationsClient } from '../pollinations/pollinations.client.js';
import {
  normalizePromptScene,
  normalizeVideoPrompt,
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
    `Scene ${index + 1} for ${topic}: a tense and mysterious historical moment frozen at the peak of suspense`,
  );
};

const createFallbackVideoPrompt = (topic: string, index: number) => {
  return normalizeVideoPrompt(
    `Scene ${index + 1} for ${topic}: bring the still image to life with restrained camera drift, believable subject motion, moving atmosphere, and a documentary-style cinematic reveal`,
  );
};

type PromptPair = {
  imagePrompt: string;
  videoPrompt: string;
};

const dedupePromptPairs = (promptPairs: PromptPair[]) => {
  const seen = new Set<string>();
  const results: PromptPair[] = [];

  for (const promptPair of promptPairs) {
    const key = `${promptPair.imagePrompt.toLowerCase()}::${promptPair.videoPrompt.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(promptPair);
  }

  return results;
};

const enforcePromptCount = (topic: string, promptPairs: PromptPair[]) => {
  const results = [...promptPairs];

  while (results.length < TARGET_PROMPT_COUNT) {
    results.push({
      imagePrompt: createFallbackPrompt(topic, results.length),
      videoPrompt: createFallbackVideoPrompt(topic, results.length),
    });
  }

  return results.slice(0, TARGET_PROMPT_COUNT);
};

const parsePromptPairCandidates = (rawText: string): PromptPair[] => {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((value): value is { imagePrompt?: unknown; videoPrompt?: unknown } =>
          typeof value === 'object' && value !== null,
        )
        .map((value) => ({
          imagePrompt: typeof value.imagePrompt === 'string' ? value.imagePrompt : '',
          videoPrompt: typeof value.videoPrompt === 'string' ? value.videoPrompt : '',
        }))
        .filter((value) => value.imagePrompt.trim().length > 0 || value.videoPrompt.trim().length > 0);
    }
  } catch {
    // Fall through to looser parsing.
  }

  const candidates = splitPromptCandidates(rawText);
  return candidates.map((candidate) => {
    const imageMatch = candidate.match(/imagePrompt\s*[:=-]\s*(.+?)(?:\s+videoPrompt\s*[:=-]\s*|$)/i);
    const videoMatch = candidate.match(/videoPrompt\s*[:=-]\s*(.+)$/i);

    return {
      imagePrompt: imageMatch?.[1] ?? candidate,
      videoPrompt: videoMatch?.[1] ?? '',
    };
  });
};

export const normalizePromptPack = (topic: string, rawText: string) => {
  const candidates = parsePromptPairCandidates(rawText);
  const normalized = candidates.map((candidate) => ({
    imagePrompt: normalizePromptScene(candidate.imagePrompt),
    videoPrompt: normalizeVideoPrompt(candidate.videoPrompt),
  }));
  const unique = dedupePromptPairs(normalized);
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
