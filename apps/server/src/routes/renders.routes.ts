import { Router } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { getRenderStatus, kickoffRender } from '../services/renders/render.service.js';

export const createRenderRouter = () => {
  const router = Router();

  const handleRender = asyncHandler(async (request, response) => {
    const audioDurationInSeconds =
      typeof request.body?.audioDurationInSeconds === 'number' ? request.body.audioDurationInSeconds : undefined;
    const audioUrl = typeof request.body?.audioUrl === 'string' ? request.body.audioUrl : undefined;
    const captions = Array.isArray(request.body?.captions) ? request.body.captions : undefined;
    const topic = typeof request.body?.topic === 'string' ? request.body.topic : '';
    const images = Array.isArray(request.body?.images) ? request.body.images : [];

    const result = await kickoffRender({ audioDurationInSeconds, audioUrl, captions, images, topic });

    response.json(result);
  });

  router.post(
    '/',
    handleRender,
  );

  router.post(
    '/kickoff',
    handleRender,
  );

  router.get(
    '/:renderId',
    asyncHandler(async (request, response) => {
      const renderId = Array.isArray(request.params.renderId)
        ? request.params.renderId[0]
        : request.params.renderId;
      const result = await getRenderStatus(renderId);

      response.json(result);
    }),
  );

  return router;
};
