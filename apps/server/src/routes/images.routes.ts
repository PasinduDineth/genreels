import { Router } from 'express';

import { AppError } from '../lib/app-error.js';
import { asyncHandler } from '../lib/async-handler.js';
import { generateImagesFromPrompts } from '../services/images/image-generation.service.js';

export const createImagesRouter = () => {
  const router = Router();

  const handleGenerate = asyncHandler(async (request, response) => {
    const prompts = Array.isArray(request.body?.prompts) ? request.body.prompts : [];

    const result = await generateImagesFromPrompts(prompts);

    response.json(result);
  });

  router.post(
    '/',
    handleGenerate,
  );

  router.post(
    '/generate',
    handleGenerate,
  );

  router.get(
    '/proxy',
    asyncHandler(async (request, response) => {
      const target = typeof request.query.target === 'string' ? request.query.target : '';

      if (!target) {
        throw new AppError('A target image URL is required.', 400, 'IMAGE_TARGET_REQUIRED');
      }

      const parsedTarget = new URL(target);

      if (!parsedTarget.hostname.endsWith('pollinations.ai')) {
        throw new AppError('Only Pollinations image URLs can be proxied.', 400, 'IMAGE_TARGET_INVALID');
      }

      const upstream = await fetch(parsedTarget, {
        headers: {
          Accept: 'image/*',
        },
      });

      if (!upstream.ok || !upstream.body) {
        throw new AppError(
          `Image proxy request failed with status ${upstream.status}.`,
          502,
          'IMAGE_PROXY_FAILED',
        );
      }

      response.setHeader('Cache-Control', 'public, max-age=3600');
      response.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');

      const arrayBuffer = await upstream.arrayBuffer();
      response.send(Buffer.from(arrayBuffer));
    }),
  );

  return router;
};
