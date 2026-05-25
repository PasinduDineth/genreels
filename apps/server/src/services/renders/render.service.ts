import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFile } from 'music-metadata';
import { AppError } from '../../lib/app-error.js';
import { env } from '../../config/env.js';

const TARGET_IMAGE_COUNT = 10;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDirectory, '../../../../../');
const remotionEntry = path.resolve(workspaceRoot, 'packages/video/src/index.ts');
const renderedDirectory = path.resolve(workspaceRoot, 'rendered');
const compositionId = 'GenreelsSilentStory';
let bundlePromise: Promise<string> | null = null;
const defaultMotions = [
  'push-in',
  'pan-right',
  'drift-up',
  'push-out',
  'pan-left',
  'push-in',
  'drift-down',
  'pan-right',
  'push-out',
  'push-in',
] as const;

type RenderImage = {
  id?: unknown;
  promptId?: unknown;
  promptText?: unknown;
  url?: unknown;
  videoDurationInSeconds?: unknown;
  videoPromptText?: unknown;
  videoUrl?: unknown;
};

type KickoffRenderInput = {
  audioDurationInSeconds?: number;
  audioUrl?: string;
  captions?: unknown[];
  images: unknown[];
  topic: string;
};

type RenderCaption = {
  endMs?: unknown;
  startMs?: unknown;
  timestampMs?: unknown;
};

type RenderRecord = {
  createdAt: string;
  imageCount: number;
  outputUrl: string | null;
  renderId: string;
  status: 'completed' | 'failed' | 'rendering';
  topic: string;
};

const renderStore = new Map<string, RenderRecord>();

const sanitizeSegment = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'genreels-story';
};

const normalizeTopic = (value: string) => value.trim() || 'Untitled mystery';

const toManagedAudioFilePath = (audioUrl: string) => {
  const parsed = new URL(audioUrl);
  const publicBaseUrl = env.publicBaseUrl.replace(/\/$/, '');

  if (parsed.origin !== publicBaseUrl || !parsed.pathname.startsWith('/generated-audio/')) {
    return null;
  }

  return path.join(workspaceRoot, 'generated-audio', path.basename(parsed.pathname));
};

const getCaptionDurationInSeconds = (captions: unknown[]) => {
  const lastTimestampMs = captions
    .filter((value): value is RenderCaption => typeof value === 'object' && value !== null)
    .reduce((maxValue, caption) => {
      const timestampMs =
        typeof caption.timestampMs === 'number' && Number.isFinite(caption.timestampMs)
          ? caption.timestampMs
          : null;
      const endMs = typeof caption.endMs === 'number' && Number.isFinite(caption.endMs) ? caption.endMs : null;
      const startMs =
        typeof caption.startMs === 'number' && Number.isFinite(caption.startMs) ? caption.startMs : null;
      const captionEnd = timestampMs ?? endMs ?? startMs;

      return captionEnd && captionEnd > maxValue ? captionEnd : maxValue;
    }, 0);

  return lastTimestampMs > 0 ? lastTimestampMs / 1000 : null;
};

const resolveRenderDurationInSeconds = async ({
  audioDurationInSeconds,
  audioUrl,
  captions,
}: {
  audioDurationInSeconds: number | null;
  audioUrl: string | null;
  captions: unknown[];
}) => {
  if (audioUrl) {
    const localAudioPath = toManagedAudioFilePath(audioUrl);

    if (localAudioPath) {
      try {
        const metadata = await parseFile(localAudioPath);
        const actualDuration = metadata.format.duration;

        if (typeof actualDuration === 'number' && Number.isFinite(actualDuration) && actualDuration > 0) {
          return actualDuration;
        }
      } catch (error) {
        console.warn('Failed to resolve audio duration from file metadata.', error);
      }
    }
  }

  const captionDurationInSeconds = getCaptionDurationInSeconds(captions);
  if (captionDurationInSeconds && captionDurationInSeconds > 0) {
    return captionDurationInSeconds;
  }

  if (audioDurationInSeconds && audioDurationInSeconds > 0) {
    return audioDurationInSeconds;
  }

  return null;
};

const normalizeImages = (images: unknown[]) => {
  const normalized = images
    .filter((value): value is RenderImage => typeof value === 'object' && value !== null)
    .map((image, index) => {
      const url = typeof image.url === 'string' ? image.url.trim() : '';
      const promptText = typeof image.promptText === 'string' ? image.promptText.trim() : '';

      if (!url || !promptText) {
        return null;
      }

      return {
        id: typeof image.id === 'string' && image.id.trim() ? image.id : `img_${index + 1}`,
        imageUrl: url,
        motion: defaultMotions[index % defaultMotions.length],
        prompt: promptText,
        videoDurationInSeconds:
          typeof image.videoDurationInSeconds === 'number' && Number.isFinite(image.videoDurationInSeconds)
            ? image.videoDurationInSeconds
            : undefined,
        videoPrompt:
          typeof image.videoPromptText === 'string' && image.videoPromptText.trim().length > 0
            ? image.videoPromptText.trim()
            : undefined,
        videoUrl:
          typeof image.videoUrl === 'string' && image.videoUrl.trim().length > 0
            ? image.videoUrl.trim()
            : undefined,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  if (normalized.length !== TARGET_IMAGE_COUNT) {
    throw new AppError(
      `Exactly ${TARGET_IMAGE_COUNT} images are required to render the MVP video.`,
      400,
      'IMAGE_COUNT_INVALID',
    );
  }

  return normalized;
};

const ensureRenderedDirectory = async () => {
  await fs.mkdir(renderedDirectory, { recursive: true });
};

const getBundleLocation = () => {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: remotionEntry,
      webpackOverride: (config) => config,
    });
  }

  return bundlePromise;
};

export const kickoffRender = async ({
  audioDurationInSeconds,
  audioUrl,
  captions,
  images,
  topic,
}: KickoffRenderInput) => {
  const normalizedAudioDurationInSeconds =
    typeof audioDurationInSeconds === 'number' && Number.isFinite(audioDurationInSeconds)
      ? Math.max(audioDurationInSeconds, 1)
      : null;
  const normalizedAudioUrl =
    typeof audioUrl === 'string' && audioUrl.trim().length > 0
      ? audioUrl.trim()
      : null;
  const normalizedCaptions = Array.isArray(captions) ? captions : [];
  const normalizedTopic = normalizeTopic(topic);
  const normalizedImages = normalizeImages(images);
  const renderId = `render_${Date.now()}`;
  const filename = `${sanitizeSegment(normalizedTopic)}-${renderId}.mp4`;
  const outputLocation = path.join(renderedDirectory, filename);

  renderStore.set(renderId, {
    createdAt: new Date().toISOString(),
    imageCount: normalizedImages.length,
    outputUrl: null,
    renderId,
    status: 'rendering',
    topic: normalizedTopic,
  });

  try {
    await ensureRenderedDirectory();

    const bundleLocation = await getBundleLocation();
    const resolvedDurationInSeconds = await resolveRenderDurationInSeconds({
      audioDurationInSeconds: normalizedAudioDurationInSeconds,
      audioUrl: normalizedAudioUrl,
      captions: normalizedCaptions,
    });

    const inputProps = {
      audioDurationInSeconds: resolvedDurationInSeconds,
      audioUrl: normalizedAudioUrl,
      captions: normalizedCaptions,
      scenes: normalizedImages,
      topic: normalizedTopic,
    };

    const composition = await selectComposition({
      id: compositionId,
      inputProps,
      serveUrl: bundleLocation,
    });

    await renderMedia({
      codec: 'h264',
      composition,
      inputProps,
      outputLocation,
      serveUrl: bundleLocation,
    });

    const outputUrl = `${env.publicBaseUrl.replace(/\/$/, '')}/rendered/${filename}`;
    const result = {
      createdAt: new Date().toISOString(),
      imageCount: normalizedImages.length,
      outputUrl,
      renderId,
      status: 'completed' as const,
      topic: normalizedTopic,
    };

    renderStore.set(renderId, result);

    return {
      renderId,
      status: result.status,
      video: {
        durationInSeconds: resolvedDurationInSeconds ?? normalizedImages.length * 3,
        url: outputUrl,
      },
    };
  } catch (error) {
    renderStore.set(renderId, {
      createdAt: new Date().toISOString(),
      imageCount: normalizedImages.length,
      outputUrl: null,
      renderId,
      status: 'failed',
      topic: normalizedTopic,
    });

    throw new AppError(
      error instanceof Error ? error.message : 'Video render failed.',
      500,
      'RENDER_FAILED',
    );
  }
};

export const getRenderStatus = async (renderId: string) => {
  const record = renderStore.get(renderId);

  if (!record) {
    return {
      message: 'No render job found for this id.',
      renderId,
      status: 'missing',
    };
  }

  return record;
};
