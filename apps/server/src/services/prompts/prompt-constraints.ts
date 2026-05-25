export const TEXT_TO_IMAGE_STYLE_SUFFIX =
  'stylized 2D comic-book illustration, handcrafted digital painting, strong cel-shaded rendering, flat color regions, hard shadow separation, clean inked outlines, visible line-art contours, graphic-novel aesthetic, hand-drawn animated look, non-photorealistic rendering, intentionally flat 2D composition, simplified geometric forms, illustrated textures only, painterly brush texture, muted cinematic blue-gray palette, controlled contrast, soft atmospheric haze painted in 2D, expressive stylized characters, anime-inspired facial simplification, no realistic skin texture, no realistic fabric simulation, no subsurface scattering, no physically based rendering, no global illumination, no realistic depth rendering, no ray tracing, no volumetric realism, no CGI look, no 3D rendering, no plastic texture, no hyper-detailing, no realistic lighting, no realistic shadows, no realistic reflections, no game-engine aesthetic, no Pixar style, preserve illustrated comic aesthetic, vertical 9:16 composition, cinematic framing, dramatic storytelling illustration';

export const IMAGE_TO_VIDEO_STYLE_LOCK_SUFFIX =
  'preserve the exact original 2D illustrated frame style throughout the entire animation, maintain identical cel-shaded comic-book rendering in every frame, preserve flat 2D illustrated surfaces, preserve hard ink outlines and graphic line-art consistency, maintain non-photorealistic rendering, maintain hand-drawn animated appearance, preserve painted textures only, preserve flat shadow regions without realistic light falloff, maintain simplified illustrated anatomy, maintain muted blue-gray cinematic palette, preserve frame-to-frame illustration consistency, preserve 2D layered parallax only, avoid realistic depth generation, avoid volumetric lighting realism, avoid physically based rendering, avoid realistic facial rendering, avoid realistic cloth simulation, avoid realistic skin texture, avoid realistic environmental shading, avoid CGI appearance, avoid 3D animated look, avoid Pixar aesthetic, avoid Unreal Engine look, avoid realistic interpolation, avoid realistic camera lens simulation, avoid realistic fog rendering, avoid realistic snow particle simulation, avoid photorealism entirely, motion should feel like a professionally animated 2D graphic novel sequence, cinematic but fully illustrated, vertical 9:16 framing, no text, no captions, no speech bubbles, no collage, no split screens';

const IMAGE_PROMPT_LEAD =
  'Stylized 2D comic-book illustration of';

const FORBIDDEN_PROMPT_PHRASES = [
  'photorealistic',
  'hyper realistic',
  'ultra detailed realism',
  'movie still',
  'realistic cinematic',
  'realistic lighting',
  'realistic shadows',
  'volumetric fog',
  'realistic particles',
  'realistic skin',
  'realistic cloth',
  'physically based rendering',
  'pbr',
  'ray tracing',
  'unreal engine',
  'octane render',
  'live action',
  'cgi realism',
] as const;

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const stripListPrefix = (value: string) => value.replace(/^\s*(?:\d+[\).\]-]\s*|[-*]\s*)/, '');

export const buildTextToImagePrompt = (scenePrompt: string) => {
  const normalized = collapseWhitespace(scenePrompt).replace(/[;,.:\-\s]*$/g, '');
  return `${normalized}\n\n${TEXT_TO_IMAGE_STYLE_SUFFIX}`;
};

export const buildImageToVideoPrompt = (scenePrompt: string) => {
  const normalized = collapseWhitespace(scenePrompt).replace(/[;,.:\-\s]*$/g, '');
  return `Animate the existing illustration without altering the original rendering style.\n\n${normalized}\n\n${IMAGE_TO_VIDEO_STYLE_LOCK_SUFFIX}`;
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

  for (const forbiddenPhrase of FORBIDDEN_PROMPT_PHRASES) {
    const pattern = new RegExp(forbiddenPhrase.replace(/\s+/g, '\\s+'), 'gi');
    normalized = normalized.replace(pattern, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  if (!/^(stylized 2d comic-book illustration of|hand-drawn cel-shaded graphic-novel illustration of|animated 2d cinematic comic-panel illustration of)\b/i.test(normalized)) {
    normalized = `${IMAGE_PROMPT_LEAD} ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
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

export const normalizeVideoPrompt = (value: string) => {
  let normalized = collapseWhitespace(stripListPrefix(value));

  if (!normalized) {
    normalized =
      'Subtle cinematic motion moves through the scene as the environment shifts naturally and the camera slowly glides forward';
  }

  normalized = normalized
    .replace(/\bthis story\b/gi, 'this scene')
    .replace(/[;,.:\-\s]*$/g, '');

  return collapseWhitespace(normalized);
};
