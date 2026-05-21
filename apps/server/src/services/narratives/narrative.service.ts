import { AppError } from '../../lib/app-error.js';
import { pollinationsClient } from '../pollinations/pollinations.client.js';

const MIN_WORDS = 150;
const MAX_WORDS = 180;
const MAX_ATTEMPTS = 3;
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

const validateNarrative = (narrative: string) => {
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

  return {
    narrative: cleaned,
    wordCount: words,
  };
};

const buildNarrativeFeedback = (error: AppError) => {
  if (error.code === 'NARRATIVE_WORD_COUNT_INVALID') {
    return `Rewrite the narrative so it is a single paragraph between ${MIN_WORDS} and ${MAX_WORDS} words. Keep it concrete, chronological, and documentary in tone.`;
  }

  if (error.code === 'NARRATIVE_STYLE_INVALID') {
    return 'Rewrite the narrative with only concrete story facts and scenes. Do not mention the audience, the viewer, this short, this story, the goal, or how the narration is structured.';
  }

  return 'Rewrite the narrative so it follows all prior instructions exactly.';
};

export const generateNarrative = async ({ topic }: { topic: string }) => {
  const normalizedTopic = ensureTopic(topic);
  let feedback: string | undefined;
  let lastValidationError: AppError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const rawNarrative = await pollinationsClient.generateNarrativeText({
      topic: normalizedTopic,
      feedback,
    });

    try {
      const validated = validateNarrative(rawNarrative);

      return {
        topic: normalizedTopic,
        narrative: validated.narrative,
        rawResponse: rawNarrative,
        wordCount: validated.wordCount,
      };
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }

      lastValidationError = error;
      feedback = buildNarrativeFeedback(error);

      console.warn('[narrative] Validation failed, retrying', {
        attempt,
        code: error.code,
        message: error.message,
      });
    }
  }

  throw (
    lastValidationError ??
    new AppError('Narrative generation failed after retries.', 502, 'NARRATIVE_GENERATION_FAILED')
  );
};
