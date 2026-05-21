const IMAGE_PROMPT_STYLE_SUFFIX =
  'stylized 2D animated comic-book illustration, cel-shaded rendering, muted blue-gray cinematic palette, clean linework, expressive characters, vertical 9:16 composition, highly cinematic lighting and atmosphere, detailed environments and dramatic composition, no text, no captions, no speech bubbles, no collage, no split screens, no multiple scenes in one canvas, edge-to-edge full-frame composition, no borders margins or padding, safe wording, one clear moment or scene';

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const stripListPrefix = (value: string) => value.replace(/^\s*(?:\d+[\).\]-]\s*|[-*]\s*)/, '');

export const getPromptConstraintSuffix = () => {
  return IMAGE_PROMPT_STYLE_SUFFIX;
};

export const appendPromptConstraintSuffix = (value: string) => {
  const normalized = collapseWhitespace(value).replace(/[;,.:\-\s]*$/g, '');
  return collapseWhitespace(`${normalized}, ${IMAGE_PROMPT_STYLE_SUFFIX}`);
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
