import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePromptPack } from './prompt-generation.service.js';
import { normalizePromptScene } from './prompt-constraints.js';

test('normalizePromptPack parses fenced JSON prompt pairs without splitting JSON lines', () => {
  const rawText = `\`\`\`json
[
  {
    "imagePrompt": "Animated 2D cinematic comic-panel illustration of a snowy forest with an eerie glow.",
    "videoPrompt": "Animate the existing illustration without altering the original rendering style. Show snow drifting."
  },
  {
    "imagePrompt": "Hand-drawn cel-shaded graphic-novel illustration of nine hikers beside a tent.",
    "videoPrompt": "Animate the existing illustration without altering the original rendering style. Show their coats moving."
  }
]
\`\`\``;

  const prompts = normalizePromptPack('Dyatlov Pass', rawText);

  assert.equal(prompts.length, 10);
  assert.equal(
    prompts[0].imagePrompt,
    'Animated 2D cinematic comic-panel illustration of a snowy forest with an eerie glow',
  );
  assert.match(prompts[0].videoPrompt, /Show snow drifting$/);
  assert.equal(
    prompts[1].imagePrompt,
    'Hand-drawn cel-shaded graphic-novel illustration of nine hikers beside a tent',
  );
  assert.doesNotMatch(prompts[0].imagePrompt, /```|imagePrompt|videoPrompt/);
});

test('normalizePromptScene preserves non-photorealistic wording', () => {
  const result = normalizePromptScene(
    'Stylized 2D comic-book illustration of a tent rendered with non-photorealistic ink outlines',
  );

  assert.match(result, /non-photorealistic ink outlines/);
  assert.doesNotMatch(result, /non-\s+ink/);
});
