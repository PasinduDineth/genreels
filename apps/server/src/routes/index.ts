import { Router } from 'express';

import { createAudioRouter } from './audio.routes.js';
import { createHealthRouter } from './health.routes.js';
import { createImagesRouter } from './images.routes.js';
import { createNarrativeRouter } from './narratives.routes.js';
import { createPromptRouter } from './prompts.routes.js';
import { createRenderRouter } from './renders.routes.js';

export const createApiRouter = () => {
  const router = Router();

  router.use('/health', createHealthRouter());
  router.use('/audio', createAudioRouter());
  router.use('/narrative', createNarrativeRouter());
  router.use('/narratives', createNarrativeRouter());
  router.use('/prompts', createPromptRouter());
  router.use('/images', createImagesRouter());
  router.use('/render', createRenderRouter());
  router.use('/renders', createRenderRouter());

  return router;
};
