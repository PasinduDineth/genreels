import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { env } from './env.js';
import { AppError } from '../lib/app-error.js';

type RunpodRequestContext = {
  gatewayBaseUrl: string;
};

const requestContext = new AsyncLocalStorage<RunpodRequestContext>();

const normalizeGatewayBaseUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new AppError('RunPod gateway base URL must be a valid URL.', 400, 'RUNPOD_GATEWAY_URL_INVALID');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('RunPod gateway base URL must use HTTP or HTTPS.', 400, 'RUNPOD_GATEWAY_URL_INVALID');
  }

  return url.toString().replace(/\/$/, '');
};

const defaultGatewayBaseUrl = normalizeGatewayBaseUrl(env.runpodGatewayBaseUrl);

export const getRunpodGatewayBaseUrl = () =>
  requestContext.getStore()?.gatewayBaseUrl ?? defaultGatewayBaseUrl;

export const runpodGatewayContext = (request: Request, _response: Response, next: NextFunction) => {
  const header = request.get('X-Runpod-Base-Url')?.trim();
  const gatewayBaseUrl = header ? normalizeGatewayBaseUrl(header) : defaultGatewayBaseUrl;
  requestContext.run({ gatewayBaseUrl }, next);
};
