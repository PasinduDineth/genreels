# Genreels

MVP TikTok shorts generator built with React, Node.js, MiniMax, and Remotion.

## Planned flow

1. Enter a story topic.
2. Generate a documentary-style narrative plus narration audio and captions.
3. Generate a documentary-style narrative with MiniMax text generation.
4. Generate 10 constrained image prompts with MiniMax text generation.
5. Generate 10 images from those prompts with MiniMax image generation.
6. Render a 9:16 short with Remotion.
7. Preview prompts, images, and the final video in the UI.

## Bundle workflow

Genreels can now export a complete reusable story package as a zip and later import that same zip to render again without regenerating assets.

### What the zip includes

- `manifest.json`
- `story-package.json`
- `render-input.json`
- `narrative.txt`
- `narrative.json`
- `prompts.json`
- `captions/captions.json` when captions exist
- `audio/narration.*` when narration audio exists
- `images/image-01.*` through `images/image-10.*`

### Why these files matter

- `manifest.json` is the canonical machine-readable bundle description used by the import flow.
- `story-package.json` gives you one simple JSON with the narrative plus the image-to-prompt mapping.
- `render-input.json` is the future-facing render handoff file with topic, scene prompts, image file references, and audio metadata.
- `prompts.json`, `narrative.json`, and `captions.json` make the package easy to inspect or reuse in external workflows.

### Export a bundle

1. Generate a story normally until the 10 images and narration are ready.
2. In the `Video preview` panel, click `Download zip`.
3. Save the exported bundle anywhere you want for later reuse.

### Import a bundle and render later

1. Open the app.
2. In the `Video preview` panel, click `Choose zip`.
3. Select a previously exported Genreels bundle.
4. Wait for the import confirmation in the status feed.
5. Click `Render video`.

The imported bundle repopulates the topic, narrative, prompts, captions, images, and narration audio in the UI. No regeneration step is required before rendering.

### Bundle format notes

- The current import path expects a Genreels-generated zip with `manifest.json`.
- Bundles should contain exactly 10 images because the current video renderer requires 10 scenes.
- Imported media is copied into the local `generated-audio` and `generated-images` folders so the normal render pipeline can use it immediately.
