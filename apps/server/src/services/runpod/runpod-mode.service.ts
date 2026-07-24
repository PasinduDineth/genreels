import { getRunpodGatewayBaseUrl } from '../../config/runpod-gateway.js';
import { AppError } from '../../lib/app-error.js';

export type RunpodMode = 'off' | 'llm' | 'tts' | 'image' | 'video';

type RunpodStatusResponse = {
  actual_mode?: string;
  stage?: string;
  transitioning?: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const postControl = async (path: string, payload: Record<string, unknown> = {}) => {
  const response = await fetch(`${getRunpodGatewayBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `RunPod control request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'RUNPOD_CONTROL_FAILED',
    );
  }

  return response.json().catch(() => ({}));
};

export const getRunpodStatus = async () => {
  const response = await fetch(`${getRunpodGatewayBaseUrl()}/control/status`);
  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `RunPod status request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}.`,
      502,
      'RUNPOD_STATUS_FAILED',
    );
  }

  return (await response.json()) as RunpodStatusResponse;
};

export const waitForRunpodMode = async (mode: RunpodMode, timeoutMs = 20 * 60 * 1000) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await getRunpodStatus();
    if (status.actual_mode === mode && !status.transitioning && status.stage === 'idle') {
      return status;
    }

    if (status.actual_mode === 'conflict') {
      throw new AppError('RunPod gateway reported a conflicting GPU state.', 502, 'RUNPOD_CONFLICT_STATE');
    }

    await sleep(5000);
  }

  throw new AppError(`Timed out waiting for RunPod mode: ${mode}.`, 504, 'RUNPOD_MODE_TIMEOUT');
};

export const switchRunpodMode = async (mode: RunpodMode) => {
  const current = await getRunpodStatus();
  if (current.actual_mode === mode && !current.transitioning && current.stage === 'idle') {
    return current;
  }

  if (mode === 'off') {
    await postControl('/control/off');
  } else {
    await postControl(`/control/${mode}/start`, mode === 'llm' ? { warmup: true } : {});
  }

  return waitForRunpodMode(mode);
};
