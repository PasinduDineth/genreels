import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RENDER_INPUT,
  TOTAL_SCENES,
  parseRenderInput,
} from "./render-schema";

test("parseRenderInput accepts the default payload", () => {
  const parsed = parseRenderInput(DEFAULT_RENDER_INPUT);

  assert.equal(parsed.scenes.length, TOTAL_SCENES);
  assert.deepEqual(parsed.captions, []);
  assert.equal(parsed.topic, DEFAULT_RENDER_INPUT.topic);
});

test("parseRenderInput rejects payloads without exactly ten scenes", () => {
  assert.throws(() => {
    parseRenderInput({
      ...DEFAULT_RENDER_INPUT,
      scenes: DEFAULT_RENDER_INPUT.scenes.slice(0, TOTAL_SCENES - 1),
    });
  });
});
