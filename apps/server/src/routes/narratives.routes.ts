import { Router } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { generateNarrative } from '../services/narratives/narrative.service.js';
import { switchRunpodMode } from '../services/runpod/runpod-mode.service.js';

export const createNarrativeRouter = () => {
  const router = Router();

  const handleGenerate = asyncHandler(async (request, response) => {
    const topic = typeof request.body?.topic === 'string' ? request.body.topic : '';
    await switchRunpodMode('llm');
    const result = await generateNarrative({ topic });

    response.json(result);
  });

  router.post('/', handleGenerate);
  router.post('/generate', handleGenerate);

  return router;
};
