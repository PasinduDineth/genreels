import express, { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { AppError } from '../lib/app-error.js';
import { createBundleArchive, importBundleArchive } from '../services/bundles/bundle.service.js';

export const createBundleRouter = () => {
  const router = Router();

  router.post(
    '/export',
    asyncHandler(async (request, response) => {
      const topic = typeof request.body?.topic === 'string' ? request.body.topic : '';
      const narrative =
        typeof request.body?.narrative === 'object' && request.body?.narrative !== null
          ? request.body.narrative
          : null;
      const prompts = Array.isArray(request.body?.prompts) ? request.body.prompts : [];
      const images = Array.isArray(request.body?.images) ? request.body.images : [];

      if (!narrative) {
        throw new AppError('Narrative data is required to export a bundle.', 400, 'BUNDLE_NARRATIVE_REQUIRED');
      }

      const result = await createBundleArchive({
        images,
        narrative: {
          audioDurationInSeconds:
            typeof narrative.audioDurationInSeconds === 'number' ? narrative.audioDurationInSeconds : undefined,
          audioUrl: typeof narrative.audioUrl === 'string' ? narrative.audioUrl : undefined,
          captions: Array.isArray(narrative.captions) ? narrative.captions : [],
          text: typeof narrative.text === 'string' ? narrative.text : '',
          wordCount: typeof narrative.wordCount === 'number' ? narrative.wordCount : 0,
        },
        prompts,
        topic,
      });

      response.setHeader('Content-Type', 'application/zip');
      response.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      response.send(result.buffer);
    }),
  );

  router.post(
    '/import',
    express.raw({
      limit: '250mb',
      type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
    }),
    asyncHandler(async (request, response) => {
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        throw new AppError('A zip bundle file is required.', 400, 'BUNDLE_IMPORT_BODY_REQUIRED');
      }

      const result = await importBundleArchive(request.body);
      response.json(result);
    }),
  );

  return router;
};
