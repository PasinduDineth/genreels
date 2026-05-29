import { Router } from 'express';

import { createAudioRouter } from './audio.routes.js';
import { createBundleRouter } from './bundles.routes.js';
import { createHealthRouter } from './health.routes.js';
import { createImagesRouter } from './images.routes.js';
import { createNarrativeRouter } from './narratives.routes.js';
import { createPromptRouter } from './prompts.routes.js';
import { createRenderRouter } from './renders.routes.js';
import { createSceneVideosRouter } from './scene-videos.routes.js';
import { createSocialMetadataRouter } from './social-metadata.routes.js';

export const createApiRouter = () => {
  const router = Router();

  router.use('/health', createHealthRouter());
  router.use('/audio', createAudioRouter());
  router.use('/bundle', createBundleRouter());
  router.use('/bundles', createBundleRouter());
  router.use('/narrative', createNarrativeRouter());
  router.use('/narratives', createNarrativeRouter());
  router.use('/prompts', createPromptRouter());
  router.use('/images', createImagesRouter());
  router.use('/scene-videos', createSceneVideosRouter());
  router.use('/social-metadata', createSocialMetadataRouter());
  router.use('/render', createRenderRouter());
  router.use('/renders', createRenderRouter());

  return router;
};
