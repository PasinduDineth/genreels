import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const workspaceRoot = path.resolve(currentDirectory, '../../../../');
export const renderedDirectory = path.join(workspaceRoot, 'rendered');
export const generatedImagesDirectory = path.join(workspaceRoot, 'generated-images');
export const generatedAudioDirectory = path.join(workspaceRoot, 'generated-audio');
export const generatedVideosDirectory = path.join(workspaceRoot, 'generated-videos');
export const backgroundMusicDirectory = path.join(workspaceRoot, 'background-music');

export const ensureMediaDirectories = async () => {
  await Promise.all([
    fs.mkdir(renderedDirectory, { recursive: true }),
    fs.mkdir(generatedImagesDirectory, { recursive: true }),
    fs.mkdir(generatedAudioDirectory, { recursive: true }),
    fs.mkdir(generatedVideosDirectory, { recursive: true }),
    fs.mkdir(backgroundMusicDirectory, { recursive: true }),
  ]);
};
