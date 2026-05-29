import { Router } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { generateSocialMetadata } from '../services/social-metadata/social-metadata.service.js';

export const createSocialMetadataRouter = () => {
  const router = Router();

  const handleGenerate = asyncHandler(async (request, response) => {
    const narrative = typeof request.body?.narrative === 'string' ? request.body.narrative : '';
    const topic = typeof request.body?.topic === 'string' ? request.body.topic : '';

    const result = await generateSocialMetadata({
      narrative,
      topic,
    });

    response.json(result);
  });

  router.post('/', handleGenerate);
  router.post('/generate', handleGenerate);

  return router;
};
