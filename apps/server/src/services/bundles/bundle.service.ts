import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import type { Caption } from '@remotion/captions';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDirectory, '../../../../../');
const generatedImagesDirectory = path.resolve(workspaceRoot, 'generated-images');
const generatedAudioDirectory = path.resolve(workspaceRoot, 'generated-audio');
const generatedVideosDirectory = path.resolve(workspaceRoot, 'generated-videos');

type PromptItem = {
  id: string;
  text: string;
  videoPrompt?: string;
};

type ImageAsset = {
  id: string;
  promptId: string;
  promptText: string;
  sourceImageUrl?: string;
  url: string;
  videoDurationInSeconds?: number;
  videoPromptText?: string;
  videoUrl?: string;
};

type NarrativeAsset = {
  audioDurationInSeconds?: number;
  audioUrl?: string;
  captions?: Caption[];
  text: string;
  wordCount: number;
};

type ExportBundleInput = {
  images: ImageAsset[];
  narrative: NarrativeAsset;
  prompts: PromptItem[];
  topic: string;
};

type BundleManifest = {
  exportedAt: string;
  format: 'genreels-bundle';
  images: Array<{
    file: string;
    id: string;
    promptId: string;
    promptText: string;
    sourceImageUrl?: string | null;
    videoDurationInSeconds?: number | null;
    videoFile?: string | null;
    videoPromptText?: string | null;
  }>;
  narrative: {
    audioDurationInSeconds: number | null;
    audioFile: string | null;
    captionsFile: string | null;
    text: string;
    wordCount: number;
  };
  prompts: PromptItem[];
  render: {
    sceneCount: number;
  };
  topic: string;
  version: 1 | 2 | 3;
};

const sanitizeSegment = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'genreels-bundle';
};

const toPublicUrl = (kind: 'audio' | 'image' | 'video', fileName: string) => {
  const baseUrl = env.publicBaseUrl.replace(/\/$/, '');
  const route =
    kind === 'audio'
      ? 'generated-audio'
      : kind === 'image'
        ? 'generated-images'
        : 'generated-videos';
  return `${baseUrl}/${route}/${fileName}`;
};

const ensureLocalManagedUrl = (assetUrl: string, kind: 'audio' | 'image' | 'video') => {
  const parsed = new URL(assetUrl);
  const expectedPathPrefix =
    kind === 'audio'
      ? '/generated-audio/'
      : kind === 'image'
        ? '/generated-images/'
        : '/generated-videos/';

  if (parsed.origin !== env.publicBaseUrl.replace(/\/$/, '') || !parsed.pathname.startsWith(expectedPathPrefix)) {
    throw new AppError(
      `Only locally managed ${kind} assets can be bundled.`,
      400,
      'BUNDLE_ASSET_URL_INVALID',
    );
  }

  return path.basename(parsed.pathname);
};

const readManagedAsset = async (assetUrl: string, kind: 'audio' | 'image' | 'video') => {
  const fileName = ensureLocalManagedUrl(assetUrl, kind);
  const directory =
    kind === 'audio'
      ? generatedAudioDirectory
      : kind === 'image'
        ? generatedImagesDirectory
        : generatedVideosDirectory;
  const absolutePath = path.join(directory, fileName);
  const content = await fs.readFile(absolutePath);

  return {
    content,
    fileName,
  };
};

const getImageExtension = (fileName: string) => path.extname(fileName) || '.jpg';

const getAudioExtension = (fileName: string) => path.extname(fileName) || '.mp3';

const getVideoExtension = (fileName: string) => path.extname(fileName) || '.mp4';

const countWords = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

export const createBundleArchive = async ({
  images,
  narrative,
  prompts,
  topic,
}: ExportBundleInput) => {
  if (!topic.trim()) {
    throw new AppError('A topic is required to export a bundle.', 400, 'BUNDLE_TOPIC_REQUIRED');
  }

  if (!narrative.text.trim()) {
    throw new AppError('A narrative is required to export a bundle.', 400, 'BUNDLE_NARRATIVE_REQUIRED');
  }

  const zip = new JSZip();
  const imagesFolder = zip.folder('images');
  if (!imagesFolder) {
    throw new AppError('Failed to create bundle archive.', 500, 'BUNDLE_FOLDER_FAILED');
  }

  const imageEntries = await Promise.all(
    images.map(async (image, index) => {
      const { content, fileName } = await readManagedAsset(image.url, 'image');
      const bundleImageName = `image-${String(index + 1).padStart(2, '0')}${getImageExtension(fileName)}`;
      imagesFolder.file(bundleImageName, content);
      let bundleVideoName: string | null = null;

      if (image.videoUrl) {
        const videoAsset = await readManagedAsset(image.videoUrl, 'video');
        bundleVideoName = `scene-video-${String(index + 1).padStart(2, '0')}${getVideoExtension(videoAsset.fileName)}`;
        zip.file(`videos/${bundleVideoName}`, videoAsset.content);
      }

      return {
        file: `images/${bundleImageName}`,
        id: image.id,
        promptId: image.promptId,
        promptText: image.promptText,
        sourceImageUrl: image.sourceImageUrl ?? null,
        videoDurationInSeconds: image.videoDurationInSeconds ?? null,
        videoFile: bundleVideoName ? `videos/${bundleVideoName}` : null,
        videoPromptText: image.videoPromptText ?? null,
      };
    }),
  );

  let audioFile: string | null = null;
  if (narrative.audioUrl) {
    const { content, fileName } = await readManagedAsset(narrative.audioUrl, 'audio');
    audioFile = `audio/narration${getAudioExtension(fileName)}`;
    zip.file(audioFile, content);
  }

  let captionsFile: string | null = null;
  if (narrative.captions?.length) {
    captionsFile = 'captions/captions.json';
    zip.file(captionsFile, JSON.stringify(narrative.captions, null, 2));
  }

  const manifest: BundleManifest = {
    exportedAt: new Date().toISOString(),
    format: 'genreels-bundle',
    images: imageEntries,
    narrative: {
      audioDurationInSeconds:
        typeof narrative.audioDurationInSeconds === 'number' && Number.isFinite(narrative.audioDurationInSeconds)
          ? narrative.audioDurationInSeconds
          : null,
      audioFile,
      captionsFile,
      text: narrative.text,
      wordCount: narrative.wordCount,
    },
    prompts,
    render: {
      sceneCount: imageEntries.length,
    },
    topic: topic.trim(),
    version: 3,
  };

  const storyPackage = {
    images: imageEntries.map((entry) => ({
      file: entry.file,
      imageId: entry.id,
      promptId: entry.promptId,
      promptText: entry.promptText,
      sourceImageUrl: entry.sourceImageUrl ?? null,
      videoDurationInSeconds: entry.videoDurationInSeconds ?? null,
      videoFile: entry.videoFile ?? null,
      videoPromptText: entry.videoPromptText ?? null,
    })),
    narrative: {
      text: narrative.text,
      wordCount: narrative.wordCount,
    },
    topic: topic.trim(),
  };

  const renderInput = {
    audioDurationInSeconds: manifest.narrative.audioDurationInSeconds,
    audioFile,
    captionsFile,
    scenes: imageEntries.map((entry, index) => ({
      id: entry.id,
      imageFile: entry.file,
      motion: [
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
      ][index % 10],
      prompt: entry.promptText,
      sourceImageUrl: entry.sourceImageUrl ?? null,
      videoDurationInSeconds: entry.videoDurationInSeconds ?? null,
      videoFile: entry.videoFile ?? null,
      videoPrompt: entry.videoPromptText ?? null,
    })),
    topic: topic.trim(),
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('story-package.json', JSON.stringify(storyPackage, null, 2));
  zip.file('prompts.json', JSON.stringify(prompts, null, 2));
  zip.file('narrative.txt', narrative.text);
  zip.file(
    'narrative.json',
    JSON.stringify(
      {
        audioDurationInSeconds: manifest.narrative.audioDurationInSeconds,
        text: narrative.text,
        wordCount: narrative.wordCount,
      },
      null,
      2,
    ),
  );
  zip.file('render-input.json', JSON.stringify(renderInput, null, 2));

  const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const fileName = `${sanitizeSegment(topic)}-bundle.zip`;

  return {
    buffer: archive,
    fileName,
  };
};

const getRequiredJson = async <T>(zip: JSZip, filePath: string): Promise<T> => {
  const file = zip.file(filePath);

  if (!file) {
    throw new AppError(`Bundle is missing ${filePath}.`, 400, 'BUNDLE_IMPORT_FILE_MISSING');
  }

  const content = await file.async('string');
  return JSON.parse(content) as T;
};

const getOptionalJson = async <T>(zip: JSZip, filePath: string | null): Promise<T | null> => {
  if (!filePath) {
    return null;
  }

  const file = zip.file(filePath);
  if (!file) {
    return null;
  }

  const content = await file.async('string');
  return JSON.parse(content) as T;
};

const getRequiredFile = (zip: JSZip, filePath: string) => {
  const file = zip.file(filePath);
  if (!file) {
    throw new AppError(`Bundle is missing ${filePath}.`, 400, 'BUNDLE_IMPORT_FILE_MISSING');
  }

  return file;
};

export const importBundleArchive = async (archive: Buffer) => {
  const zip = await JSZip.loadAsync(archive);
  const manifest = await getRequiredJson<BundleManifest>(zip, 'manifest.json');

  if (manifest.format !== 'genreels-bundle' || ![1, 2, 3].includes(manifest.version)) {
    throw new AppError('Unsupported bundle format.', 400, 'BUNDLE_IMPORT_FORMAT_INVALID');
  }

  await Promise.all([
    fs.mkdir(generatedAudioDirectory, { recursive: true }),
    fs.mkdir(generatedImagesDirectory, { recursive: true }),
    fs.mkdir(generatedVideosDirectory, { recursive: true }),
  ]);

  const bundleId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  let audioUrl: string | undefined;
  if (manifest.narrative.audioFile) {
    const audioZipFile = getRequiredFile(zip, manifest.narrative.audioFile);
    const audioBuffer = await audioZipFile.async('nodebuffer');
    const audioFileName = `${bundleId}-narration${getAudioExtension(manifest.narrative.audioFile)}`;
    await fs.writeFile(path.join(generatedAudioDirectory, audioFileName), audioBuffer);
    audioUrl = toPublicUrl('audio', audioFileName);
  }

  const captions =
    (await getOptionalJson<Caption[]>(zip, manifest.narrative.captionsFile)) ?? [];

  const prompts = manifest.prompts.map((prompt) => ({
    id: prompt.id,
    text: prompt.text,
    videoPrompt: prompt.videoPrompt ?? '',
  }));

  const images = await Promise.all(
    manifest.images.map(async (imageEntry, index) => {
      const imageZipFile = getRequiredFile(zip, imageEntry.file);
      const imageBuffer = await imageZipFile.async('nodebuffer');
      const imageFileName = `${bundleId}-image-${String(index + 1).padStart(2, '0')}${getImageExtension(imageEntry.file)}`;
      await fs.writeFile(path.join(generatedImagesDirectory, imageFileName), imageBuffer);
      let videoUrl: string | undefined;

      if (imageEntry.videoFile) {
        const videoZipFile = getRequiredFile(zip, imageEntry.videoFile);
        const videoBuffer = await videoZipFile.async('nodebuffer');
        const videoFileName = `${bundleId}-scene-${String(index + 1).padStart(2, '0')}${getVideoExtension(imageEntry.videoFile)}`;
        await fs.writeFile(path.join(generatedVideosDirectory, videoFileName), videoBuffer);
        videoUrl = toPublicUrl('video', videoFileName);
      }

      return {
        id: imageEntry.id,
        promptId: imageEntry.promptId,
        promptText: imageEntry.promptText,
        sourceImageUrl: imageEntry.sourceImageUrl ?? undefined,
        url: toPublicUrl('image', imageFileName),
        videoDurationInSeconds: imageEntry.videoDurationInSeconds ?? undefined,
        videoPromptText: imageEntry.videoPromptText ?? undefined,
        videoUrl,
      };
    }),
  );

  const narrativeText = manifest.narrative.text.trim();
  const wordCount = manifest.narrative.wordCount || countWords(narrativeText);

  return {
    images,
    narrative: {
      audioDurationInSeconds: manifest.narrative.audioDurationInSeconds ?? undefined,
      audioUrl,
      captions,
      text: narrativeText,
      wordCount,
    },
    prompts,
    topic: manifest.topic,
  };
};
