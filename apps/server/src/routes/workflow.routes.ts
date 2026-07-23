import { Router } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { runpodPipelineService } from '../services/orchestration/runpod-pipeline.service.js';

export const createWorkflowRouter = () => {
  const router = Router();

  router.post(
    '/full',
    asyncHandler(async (request, response) => {
      const topic = typeof request.body?.topic === 'string' ? request.body.topic : '';
      const result = await runpodPipelineService.generateFullPipeline(topic);
      response.json(result);
    }),
  );

  return router;
};