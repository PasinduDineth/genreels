import { AppError } from '../../lib/app-error.js';
import { pollinationsClient } from '../pollinations/pollinations.client.js';

const MIN_TITLE_LENGTH = 40;
const MAX_TITLE_LENGTH = 60;
const MIN_DESCRIPTION_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 150;
const MODEL_HASHTAG_COUNT = 5;
const MAX_ATTEMPTS = 3;

type SocialMetadata = {
  title: string;
  description: string;
  hashtags: string[];
};

const ensureNarrative = (narrative: string) => {
  const normalized = narrative.trim();

  if (!normalized) {
    throw new AppError('A narrative is required to generate social metadata.', 400, 'NARRATIVE_REQUIRED');
  }

  return normalized;
};

const extractJsonObject = (value: string) => {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new AppError('MiniMax did not return a valid metadata JSON object.', 502, 'SOCIAL_METADATA_JSON_INVALID');
  }

  return value.slice(start, end + 1);
};

const normalizeHashtag = (value: string) => {
  const compact = value.replace(/\s+/g, '').trim();
  if (!compact) {
    return '';
  }

  return compact.startsWith('#') ? compact.toLowerCase() : `#${compact.toLowerCase()}`;
};

const validateSocialMetadata = (payload: unknown): SocialMetadata => {
  const candidate = payload as {
    title?: unknown;
    description?: unknown;
    hashtags?: unknown;
  };

  const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
  const description = typeof candidate.description === 'string' ? candidate.description.trim() : '';
  const hashtags = Array.isArray(candidate.hashtags)
    ? candidate.hashtags
        .filter((item): item is string => typeof item === 'string')
        .map(normalizeHashtag)
        .filter(Boolean)
    : [];

  if (title.length < MIN_TITLE_LENGTH || title.length > MAX_TITLE_LENGTH) {
    throw new AppError(
      `Title must be between ${MIN_TITLE_LENGTH} and ${MAX_TITLE_LENGTH} characters. Received ${title.length}.`,
      502,
      'SOCIAL_TITLE_LENGTH_INVALID',
    );
  }

  if (description.length < MIN_DESCRIPTION_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
    throw new AppError(
      `Description must be between ${MIN_DESCRIPTION_LENGTH} and ${MAX_DESCRIPTION_LENGTH} characters. Received ${description.length}.`,
      502,
      'SOCIAL_DESCRIPTION_LENGTH_INVALID',
    );
  }

  const uniqueHashtags = Array.from(new Set(hashtags.filter((tag) => tag !== '#shorts')));
  if (uniqueHashtags.length !== MODEL_HASHTAG_COUNT) {
    throw new AppError(
      `Hashtags must contain exactly ${MODEL_HASHTAG_COUNT} unique items before #shorts is added. Received ${uniqueHashtags.length}.`,
      502,
      'SOCIAL_HASHTAGS_INVALID',
    );
  }

  return {
    title,
    description,
    hashtags: [...uniqueHashtags, '#shorts'],
  };
};

const buildRevisionFeedback = (error: AppError) => {
  if (error.code === 'SOCIAL_TITLE_LENGTH_INVALID') {
    return `Rewrite the title so it is strictly between ${MIN_TITLE_LENGTH} and ${MAX_TITLE_LENGTH} characters while keeping the viral hook and SEO focus.`;
  }

  if (error.code === 'SOCIAL_DESCRIPTION_LENGTH_INVALID') {
    return `Rewrite the description so it is strictly between ${MIN_DESCRIPTION_LENGTH} and ${MAX_DESCRIPTION_LENGTH} characters while keeping it punchy and SEO-friendly.`;
  }

  if (error.code === 'SOCIAL_HASHTAGS_INVALID') {
    return `Return exactly ${MODEL_HASHTAG_COUNT} unique hashtags in the hashtags array. Do not include #shorts.`;
  }

  return 'Return only valid JSON with the exact required title, description, and hashtag constraints.';
};

export const generateSocialMetadata = async ({
  narrative,
  topic,
}: {
  narrative: string;
  topic?: string;
}) => {
  const normalizedNarrative = ensureNarrative(narrative);
  const normalizedTopic = topic?.trim() || undefined;
  let feedback: string | undefined;
  let lastValidationError: AppError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const rawResponse = await pollinationsClient.generateSocialMetadataText({
      feedback,
      narrative: normalizedNarrative,
      topic: normalizedTopic,
    });

    try {
      const parsed = JSON.parse(extractJsonObject(rawResponse)) as unknown;
      const validated = validateSocialMetadata(parsed);

      return {
        ...validated,
        rawResponse,
      };
    } catch (error) {
      if (!(error instanceof AppError)) {
        if (error instanceof SyntaxError) {
          lastValidationError = new AppError(
            'MiniMax returned malformed metadata JSON.',
            502,
            'SOCIAL_METADATA_JSON_INVALID',
          );
          feedback = buildRevisionFeedback(lastValidationError);
          continue;
        }

        throw error;
      }

      lastValidationError = error;
      feedback = buildRevisionFeedback(error);

      console.warn('[social-metadata] Validation failed, retrying', {
        attempt,
        code: error.code,
        message: error.message,
      });
    }
  }

  throw (
    lastValidationError ??
    new AppError('Social metadata generation failed after retries.', 502, 'SOCIAL_METADATA_GENERATION_FAILED')
  );
};
