import {
  API_BASE_URL,
  PROMPT_COUNT,
  USE_MOCKS,
} from './config';
import type {
  ImageAsset,
  ImageGenerationRequest,
  ImageGenerationResponse,
  NarrativeGenerationRequest,
  NarrativeGenerationResponse,
  PromptGenerationRequest,
  PromptGenerationResponse,
  PromptItem,
  VideoRenderRequest,
  VideoRenderResponse,
} from '../types';

const HISTORY_STORY_RULES =
  'modern action cartoon style, vertical 9:16 composition, highly cinematic lighting and atmosphere, detailed environments and dramatic composition, no text, no captions, no speech bubbles, no collage, no split screens, no multiple scenes in one canvas, edge-to-edge full-frame composition, no borders, margins, or padding, safe wording, only one clear moment or scene.';

const SAMPLE_VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toId = (prefix: string, index: number) => `${prefix}-${index + 1}`;

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const createPlaceholderImage = (label: string, index: number) => {
  const hue = (index * 31) % 360;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="hsl(${hue} 80% 54%)" />
          <stop offset="100%" stop-color="hsl(${(hue + 90) % 360} 75% 18%)" />
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#bg)" />
      <circle cx="540" cy="620" r="260" fill="rgba(255,255,255,0.14)" />
      <rect x="118" y="1180" width="844" height="420" rx="42" fill="rgba(8,13,24,0.58)" />
      <text x="160" y="1290" fill="#F6F7FB" font-size="52" font-family="Georgia, serif">
        Scene ${index + 1}
      </text>
      <text x="160" y="1380" fill="#F6F7FB" font-size="34" font-family="Arial, sans-serif">
        ${escapeXml(label.slice(0, 72))}
      </text>
      <text x="160" y="1430" fill="#D4DCF7" font-size="34" font-family="Arial, sans-serif">
        ${escapeXml(label.slice(72, 144))}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const buildMockPrompts = (topic: string): PromptItem[] =>
  Array.from({length: PROMPT_COUNT}, (_, index) => ({
    id: toId('prompt', index),
    text: `${topic.trim()} scene ${index + 1}: ${HISTORY_STORY_RULES}`,
  }));

const buildMockNarrative = (topic: string) => {
  const narrative = `This story sounds invented, but it is rooted in a real historical mystery. ${topic.trim()} still fascinates people because the public record gives us just enough certainty to understand what happened, but not enough to settle why it happened. In this short, the viewer is pulled in fast with the most dramatic known moment, then guided through the setting, the key people, and the evidence that turned an ordinary event into a lasting puzzle. Each beat stays educational rather than sensational, focusing on what witnesses described, what investigators documented, and where the contradictions begin to appear. By the end, the audience should understand the true timeline, the reason this story still matters, and the unanswered detail that keeps researchers, documentary makers, and curious viewers coming back. It is eerie, factual, visual, and built to make one real mystery memorable in under a minute.`;

  return {
    narrative,
    topic,
    wordCount: narrative.trim().split(/\s+/).filter(Boolean).length,
  };
};

const buildMockImages = (prompts: PromptItem[]): ImageAsset[] =>
  prompts.map((prompt, index) => ({
    id: toId('image', index),
    promptId: prompt.id,
    promptText: prompt.text,
    url: createPlaceholderImage(prompt.text, index),
  }));

async function requestJson<TResponse>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export const apiClient = {
  async uploadNarrationAudio(
    topic: string,
    audioBlob: Blob,
  ): Promise<{ audioUrl: string; fileName: string }> {
    const response = await fetch(
      `${API_BASE_URL}/audio/upload?topic=${encodeURIComponent(topic)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': audioBlob.type || 'audio/mpeg',
        },
        body: audioBlob,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Audio upload failed with status ${response.status}`);
    }

    return (await response.json()) as { audioUrl: string; fileName: string };
  },

  async generateNarrative(
    payload: NarrativeGenerationRequest,
  ): Promise<NarrativeGenerationResponse> {
    if (USE_MOCKS) {
      await sleep(650);
      return buildMockNarrative(payload.topic);
    }

    return requestJson<NarrativeGenerationResponse>(`${API_BASE_URL}/narrative`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async generatePrompts(
    payload: PromptGenerationRequest,
  ): Promise<PromptGenerationResponse> {
    if (USE_MOCKS) {
      await sleep(700);
      return {narrative: payload.narrative, prompts: buildMockPrompts(payload.topic)};
    }

    return requestJson<PromptGenerationResponse>(`${API_BASE_URL}/prompts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async generateImages(
    payload: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    if (USE_MOCKS) {
      await sleep(900);
      const prompts = payload.prompts.map((text, index) => ({
        id: toId('prompt', index),
        text,
      }));
      return {images: buildMockImages(prompts)};
    }

    return requestJson<ImageGenerationResponse>(`${API_BASE_URL}/images`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async renderVideo(
    payload: VideoRenderRequest,
  ): Promise<VideoRenderResponse> {
    if (USE_MOCKS) {
      await sleep(1200);
      return {
        video: {
          url: SAMPLE_VIDEO_URL,
          durationInSeconds: payload.images.length * 2.5,
        },
      };
    }

    return requestJson<VideoRenderResponse>(`${API_BASE_URL}/render`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
