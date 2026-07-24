import assert from 'node:assert/strict';
import test from 'node:test';
import { runpodGatewayContext } from '../../config/runpod-gateway.js';
import { resolveRunpodVideoUrl } from './scene-video.service.js';

test('resolveRunpodVideoUrl resolves gateway-relative generated video paths', async () => {
  const request = {
    get: (name: string) =>
      name.toLowerCase() === 'x-runpod-base-url'
        ? 'https://example-pod-8001.proxy.runpod.net'
        : undefined,
  };

  await new Promise<void>((resolve, reject) => {
    runpodGatewayContext(request as never, {} as never, () => {
      try {
        assert.equal(
          resolveRunpodVideoUrl('/files/generated/videos/job.mp4'),
          'https://example-pod-8001.proxy.runpod.net/files/generated/videos/job.mp4',
        );
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
});
