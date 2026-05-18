const REQUIRED_PHRASES = [
  'modern action cartoon style',
  'vertical 9:16 composition',
  'highly cinematic lighting and atmosphere',
  'detailed environments and dramatic composition',
  'no text',
  'no captions',
  'no speech bubbles',
  'no collage',
  'no split screens',
  'no multiple scenes in one canvas',
  'edge-to-edge full-frame composition',
  'no borders, margins, or padding',
  'safe wording that does not violate image generation policies',
  'only one clear moment or scene',
] as const;

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const stripListPrefix = (value: string) => value.replace(/^\s*(?:\d+[\).\]-]\s*|[-*]\s*)/, '');

export const getPromptConstraintSuffix = () => {
  return REQUIRED_PHRASES.join(', ');
};

export const normalizePromptScene = (value: string) => {
  let normalized = collapseWhitespace(stripListPrefix(value));

  if (!normalized) {
    normalized = 'A shadowy historical mystery scene unfolding at dusk';
  }

  normalized = normalized
    .replace(/\bno text or captions\b/gi, 'no text, no captions')
    .replace(/\bno text or speech bubbles\b/gi, 'no text, no speech bubbles')
    .replace(/[;,.:\-\s]*$/g, '');

  const lower = normalized.toLowerCase();
  const missing = REQUIRED_PHRASES.filter((phrase) => !lower.includes(phrase.toLowerCase()));

  if (missing.length > 0) {
    normalized = `${normalized}, ${missing.join(', ')}`;
  }

  return collapseWhitespace(normalized);
};

export const splitPromptCandidates = (rawText: string) => {
  if (!rawText.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string');
    }
  } catch {
    // Fall through to line-based parsing.
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines;
  }

  return rawText
    .split(/\s(?=\d+[\).\]-]\s+)/)
    .map((segment) => segment.trim())
    .filter(Boolean);
};
