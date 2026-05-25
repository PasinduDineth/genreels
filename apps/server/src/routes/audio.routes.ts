import express, { Router } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { AppError } from '../lib/app-error.js';
import { generateNarrationAudio, saveNarrationAudio } from '../services/audio/audio.service.js';

export const createAudioRouter = () => {
  const router = Router();

  router.post(
    '/generate',
    asyncHandler(async (request, response) => {
      const text = typeof request.body?.text === 'string' ? request.body.text : '';
      const topic = typeof request.body?.topic === 'string' ? request.body.topic : 'narration';

      const result = await generateNarrationAudio({
        text,
        topic,
      });

      response.json(result);
    }),
  );

  router.post(
    '/upload',
    express.raw({ limit: '20mb', type: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/*'] }),
    asyncHandler(async (request, response) => {
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        throw new AppError('Audio upload body is required.', 400, 'AUDIO_BODY_REQUIRED');
      }

      const topic = typeof request.query.topic === 'string' ? request.query.topic : 'narration';
      const contentType = typeof request.headers['content-type'] === 'string'
        ? request.headers['content-type']
        : 'audio/mpeg';

      const result = await saveNarrationAudio({
        audioBuffer: request.body,
        contentType,
        topic,
      });

      response.json(result);
    }),
  );

  return router;
};
