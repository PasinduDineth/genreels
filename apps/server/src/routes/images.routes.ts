import { Router } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { generateImagesFromPrompts } from '../services/images/image-generation.service.js';

export const createImagesRouter = () => {
  const router = Router();

  const handleGenerate = asyncHandler(async (request, response) => {
    const prompts = Array.isArray(request.body?.prompts)
      ? request.body.prompts.map((prompt: unknown, index: number) => {
          if (typeof prompt === 'string') {
            return {
              id: `prompt_${index + 1}`,
              text: prompt,
            };
          }

          return prompt;
        })
      : [];

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
