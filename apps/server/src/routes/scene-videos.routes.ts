import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { generateSceneVideoPreview } from '../services/videos/scene-video.service.js';

export const createSceneVideosRouter = () => {
  const router = Router();

  const handleGenerate = asyncHandler(async (request, response) => {
    const sceneIndex =
      typeof request.body?.sceneIndex === 'number' && Number.isFinite(request.body.sceneIndex)
        ? Math.max(0, request.body.sceneIndex)
        : 0;
    const image = typeof request.body?.image === 'object' && request.body.image !== null ? request.body.image : {};

    const result = await generateSceneVideoPreview({
      image,
      sceneIndex,
    });

    response.json(result);
  });

  router.post('/', handleGenerate);
  router.post('/generate', handleGenerate);

  return router;
};
