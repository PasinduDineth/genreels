import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';

type PromptGenerationRequest = {
  topic?: string;
  narrative?: string;
};

type NarrativeGenerationRequest = {
  topic: string;
  feedback?: string;
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
    'Every prompt must include all of the following constraints naturally: stylized 2D animated comic-book illustration, cel-shaded rendering, muted blue-gray cinematic palette, clean linework, expressive characters, vertical 9:16 composition, highly cinematic lighting and atmosphere, detailed environments and dramatic composition, no text, no captions, no speech bubbles, no collage, no split screens, no multiple scenes in one canvas, edge-to-edge full-frame composition, no borders margins or padding, safe wording, one clear moment or scene.',
    'Avoid graphic gore, hate, sexual content, brands, watermarks, copyrighted characters, and unsafe instructions.',
    'Return only the 10 prompts.',
  ].join(' ');
};

const parseMiniMaxAnthropicResponse = (data: {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}) =>
  data.content
    ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .trim() ?? '';

const requestTextViaMiniMax = async (
  model: string,
  requestBody: {
    messages: PollinationsMessage[];
  },
) => {
  if (!env.minimaxApiKey) {
    throw new AppError(
      'MINIMAX_API_KEY is not configured.',
      500,
      'MINIMAX_API_KEY_MISSING',
    );
  }

  console.log('[minimax:text] Sending request', {
    url: env.minimaxTextBaseUrl,
    model,
    messageCount: requestBody.messages.length,
    apiKeyLength: env.minimaxApiKey.length,
    apiKeyPrefix: env.minimaxApiKey.slice(0, 6),
    apiKeySuffix: env.minimaxApiKey.slice(-4),
  });

  const response = await fetch(env.minimaxTextBaseUrl, {
    method: 'POST',
    headers: {
      'X-Api-Key': env.minimaxApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: requestBody.messages,
    }),
  });

  console.log('[minimax:text] Received response', {
    model,
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    console.error('[minimax:text] Error body', bodyText);
    throw new AppError(
      `MiniMax text request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ''}`,
      500,
      'MINIMAX_TEXT_FAILED',
    );
  }

  const data = (await response.json()) as {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
  console.log('[minimax:text] Raw response', data);

  const content = parseMiniMaxAnthropicResponse(data);
  console.log('[minimax:text] Parsed response', {
    model,
    contentLength: content?.length ?? 0,
  });
  if (!content) {
    throw new AppError(
      'MiniMax returned an empty text response.',
      500,
      'MINIMAX_EMPTY_RESPONSE',
    );
  }

  return content;
};

export const pollinationsClient = {
  async generateNarrativeText({ topic, feedback }: NarrativeGenerationRequest): Promise<string> {
    const requestBody = {
      messages: [
        {
          role: 'system',
          content: createNarrativeSystemMessage(),
        },
        {
          role: 'user',
          content: feedback ? `Topic: ${topic}\nRevision notes: ${feedback}` : `Topic: ${topic}`,
        },
      ] satisfies PollinationsMessage[],
    };

    return requestTextViaMiniMax(env.minimaxNarrativeModel, requestBody);
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

    return requestTextViaMiniMax(env.minimaxPromptModel, requestBody);
  },
};
