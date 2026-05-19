import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';

const buildImageUrl = (prompt: string) => {
  const baseUrl = env.pollinationsImageBaseUrl.replace(/\/$/, '');
  const url = new URL(`${baseUrl}/${encodeURIComponent(prompt)}`);
  url.searchParams.set('model', env.pollinationsImageModel);
  url.searchParams.set('width', '1080');
  url.searchParams.set('height', '1920');
  url.searchParams.set('nologo', 'true');
  return url.toString();
};

type PromptGenerationRequest = {
  topic?: string;
  narrative?: string;
};

type PollinationsMessage = {
  role: 'system' | 'user';
  content: string;
};

const createNarrativeSystemMessage = () => {
  return [
    'Write one documentary-style true-story narrative between 150 and 180 words.',
    'Target about 165 to 175 words for safety.',
    'The first sentence must be a punchy hook like a strong YouTube or TikTok opener.',
    'The paragraph must sound like real narration, not like instructions about narration.',
    'Use concrete facts, places, people, actions, and consequences whenever they are known.',
    'Make it chronological enough that 10 sequential visual scenes can be extracted from it.',
    'Keep the tone vivid, educational, and cinematic, but grounded in reality.',
    'Before responding, count the words and make sure the final paragraph stays within the required range.',
    'Do not use meta phrasing such as "this short", "the viewer", "the goal is", "by the end", or "this story opens with".',
    'Do not mention hashtags, scene numbers, emojis, bullet points, or markdown.',
    'Return only one paragraph.',
  ].join(' ');
};

const createPromptGeneratorSystemMessage = () => {
  return [
    'Generate exactly 10 image prompts as plain lines, one prompt per line.',
    'Each prompt must describe a single clear cinematic scene for a TikTok shorts visual sequence.',
    'The prompts must follow the narrative story line closely and progress from beginning to end in chronological order.',
    'Each prompt should capture a different beat from the narrative, not repeat the same moment with slight wording changes.',
    'Use concrete visual details from the narrative: locations, objects, actions, people, aftermath, and evidence when available.',
    'Do not use abstract narration language such as "the viewer", "this story", "the mystery deepens", or "history remembers".',
    'Every prompt must include all of the following constraints naturally: modern action cartoon style, vertical 9:16 composition, highly cinematic lighting and atmosphere, detailed environments and dramatic composition, no text, no captions, no speech bubbles, no collage, no split screens, no multiple scenes in one canvas, edge-to-edge full-frame composition, no borders margins or padding, safe wording, one clear moment or scene.',
    'Avoid graphic gore, hate, sexual content, brands, watermarks, copyrighted characters, and unsafe instructions.',
    'Return only the 10 prompts.',
  ].join(' ');
};

const parseChatResponse = (data: {
  choices?: Array<{ message?: { content?: string } }>;
  response?: string;
  text?: string;
}) => data.choices?.[0]?.message?.content ?? data.response ?? data.text ?? '';

const requestTextViaPollinations = async (
  model: string,
  requestBody: {
    messages: PollinationsMessage[];
  },
) => {
  if (!env.openRouterApiKey) {
    throw new AppError(
      'OPENROUTER_API_KEY is not configured.',
      500,
      'OPENROUTER_API_KEY_MISSING',
    );
  }

  const response = await fetch(`${env.openRouterBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.publicBaseUrl,
      'X-Title': 'Genreels MVP',
    },
    body: JSON.stringify({
      model,
      messages: requestBody.messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new AppError(
      `OpenRouter text request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}`,
      500,
      'OPENROUTER_TEXT_FAILED',
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    response?: string;
    text?: string;
  };

  const content = parseChatResponse(data)?.trim();
  if (!content) {
    throw new AppError(
      'OpenRouter returned an empty text response.',
      500,
      'OPENROUTER_EMPTY_RESPONSE',
    );
  }

  return content;
};

export const pollinationsClient = {
  async generateNarrativeText({ topic }: { topic: string }): Promise<string> {
    const requestBody = {
      messages: [
        {
          role: 'system',
          content: createNarrativeSystemMessage(),
        },
        {
          role: 'user',
          content: `Topic: ${topic}`,
        },
      ] satisfies PollinationsMessage[],
    };

    return requestTextViaPollinations(env.openRouterNarrativeModel, requestBody);
  },

  async generatePromptText({ topic, narrative }: PromptGenerationRequest): Promise<string> {
    const requestBody = {
      messages: [
        {
          role: 'system',
          content: createPromptGeneratorSystemMessage(),
        },
        {
          role: 'user',
          content: `Topic: ${topic ?? 'Unknown true story'}\nNarrative: ${narrative ?? ''}`,
        },
      ] satisfies PollinationsMessage[],
    };

    return requestTextViaPollinations(env.openRouterPromptModel, requestBody);
  },

  buildImageRequest(prompt: string) {
    return {
      prompt,
      imageUrl: buildImageUrl(prompt),
      model: env.pollinationsImageModel,
      width: 1080,
      height: 1920,
    };
  },
};
