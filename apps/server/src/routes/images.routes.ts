import { Router } from 'express';

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

  return router;
};
