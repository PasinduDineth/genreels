import { Router } from 'express';

export const createHealthRouter = () => {
  const router = Router();

  router.get('/', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'genreels-server',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
};
