import { Router } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { generateNarrative } from '../services/narratives/narrative.service.js';

export const createNarrativeRouter = () => {
  const router = Router();

  const handleGenerate = asyncHandler(async (request, response) => {
    const topic = typeof request.body?.topic === 'string' ? request.body.topic : '';
    const result = await generateNarrative({ topic });

    response.json(result);
  });

  router.post('/', handleGenerate);
  router.post('/generate', handleGenerate);

  return router;
};
