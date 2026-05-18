import { Router } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { generatePromptPack } from '../services/prompts/prompt-generation.service.js';

export const createPromptRouter = () => {
  const router = Router();

  const handleGenerate = asyncHandler(async (request, response) => {
    const narrative = typeof request.body?.narrative === 'string' ? request.body.narrative : '';
    const topic = typeof request.body?.topic === 'string' ? request.body.topic : '';

    const result = await generatePromptPack({ narrative, topic });

    response.json({
      narrative: result.narrative,
      promptCount: result.promptCount,
      prompts: result.prompts.map((prompt, index) => ({
        id: `prompt_${index + 1}`,
        text: prompt,
      })),
      rawResponse: result.rawResponse,
      topic: result.topic,
    });
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
