import { AppError } from '../../lib/app-error.js';
import { pollinationsClient } from '../pollinations/pollinations.client.js';

const MIN_WORDS = 150;
const MAX_WORDS = 160;
const META_PATTERNS = [
  /\bthis short\b/i,
  /\bthe viewer\b/i,
  /\bthe goal is\b/i,
  /\bby the end\b/i,
  /\bthis story\b/i,
  /\bopens with\b/i,
  /\bwalks the viewer through\b/i,
];

const ensureTopic = (topic: string) => {
  const normalized = topic.trim();

  if (!normalized) {
    throw new AppError('A topic is required to generate a narrative.', 400, 'TOPIC_REQUIRED');
  }

  return normalized;
};

const countWords = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const normalizeNarrative = (narrative: string) => {
  const cleaned = narrative.replace(/\s+/g, ' ').trim();
  const words = countWords(cleaned);
  const hasMetaLanguage = META_PATTERNS.some((pattern) => pattern.test(cleaned));

  if (words < MIN_WORDS || words > MAX_WORDS) {
    throw new AppError(
      `Narrative must be between ${MIN_WORDS} and ${MAX_WORDS} words. Received ${words}.`,
      502,
      'NARRATIVE_WORD_COUNT_INVALID',
    );
  }

  if (hasMetaLanguage) {
    throw new AppError(
      'Narrative used generic meta phrasing instead of specific documentary-style storytelling.',
      502,
      'NARRATIVE_STYLE_INVALID',
    );
  }

  return cleaned;
};

export const generateNarrative = async ({ topic }: { topic: string }) => {
  const normalizedTopic = ensureTopic(topic);
  const rawNarrative = await pollinationsClient.generateNarrativeText({
    topic: normalizedTopic,
  });
  const narrative = normalizeNarrative(rawNarrative);

  return {
    topic: normalizedTopic,
    narrative,
    rawResponse: rawNarrative,
    wordCount: countWords(narrative),
  };
};
