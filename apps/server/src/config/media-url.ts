import { env } from './env.js';
import { AppError } from '../lib/app-error.js';

const normalizePublicBaseUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new AppError('PUBLIC_BASE_URL must be a valid URL.', 500, 'PUBLIC_BASE_URL_INVALID');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('PUBLIC_BASE_URL must use HTTP or HTTPS.', 500, 'PUBLIC_BASE_URL_INVALID');
  }

  return url.toString().replace(/\/$/, '');
};

const mediaPublicBaseUrl = normalizePublicBaseUrl(env.publicBaseUrl);

export const getMediaPublicBaseUrl = () => mediaPublicBaseUrl;

export const getMediaPublicUrl = (pathName: string) =>
  `${mediaPublicBaseUrl}/${pathName.replace(/^\/+/, '')}`;
