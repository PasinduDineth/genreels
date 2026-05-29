import cors from 'cors';
import express from 'express';

import { AppError } from './lib/app-error.js';
import { createApiRouter } from './routes/index.js';
import { env } from './config/env.js';
import {
  backgroundMusicDirectory,
  ensureMediaDirectories,
  generatedAudioDirectory,
  generatedImagesDirectory,
  generatedVideosDirectory,
  renderedDirectory,
} from './lib/media-paths.js';

export const app = express();
void ensureMediaDirectories().catch((error) => {
  console.error('Failed to create media directories on startup.', error);
});

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use('/rendered', express.static(renderedDirectory));
app.use('/generated-images', express.static(generatedImagesDirectory));
app.use('/generated-audio', express.static(generatedAudioDirectory));
app.use('/generated-videos', express.static(generatedVideosDirectory));
app.use('/background-music', express.static(backgroundMusicDirectory));

app.get('/', (_request, response) => {
  response.json({
    backgroundMusicDirectory,
    name: 'Genreels API',
    status: 'ok',
  });
});

app.use('/api', createApiRouter());

app.use((request, response) => {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route found for ${request.method} ${request.originalUrl}`,
    },
  });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  const code = error instanceof AppError ? error.code : 'INTERNAL_SERVER_ERROR';

  response.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
});
