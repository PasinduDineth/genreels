export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:4000/api';

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export const PROMPT_COUNT = 10;
