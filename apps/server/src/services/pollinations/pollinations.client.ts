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

type SocialMetadataGenerationRequest = {
  narrative: string;
  topic?: string;
  feedback?: string;
};

type PollinationsMessage = {
  role: 'system' | 'user';
  content: string;
};

const createNarrativeSystemMessage = () => {
  return [
    'Write one documentary-style true story narrative between 150 and 180 words.',
    'Target 165 to 175 words.',
    'Return exactly one paragraph.',
    'Return only the story.',
    'Do not use markdown, bullet points, hashtags, emojis, or scene numbers.',
    'The first sentence must be a shocking viral hook.',
    'The hook must reveal a surprising outcome, danger, mystery, or impossible claim.',
    'The hook must create immediate curiosity.',
    'Do not start with birth dates, occupations, locations, or background information.',
    'Start as close as possible to the most dramatic moment.',
    'Write for TikTok and YouTube Shorts voiceovers.',
    'The narration must feel cinematic, urgent, emotional, and easy to read aloud.',
    'Use simple spoken English.',
    'Avoid textbook language, encyclopedia language, academic language, and poetic language.',
    'Average sentence length should be 8 to 12 words.',
    'Maximum sentence length is 16 words.',
    'Mix short and medium sentences.',
    'Do not make every sentence the same length.',
    'One sentence should express one main idea or event.',
    'Most sentences should contain no commas.',
    'Never use more than one comma in a sentence.',
    'Avoid semicolons.',
    'Avoid em dashes.',
    'Avoid parentheses.',
    'Choose one main dramatic incident and build the story around it.',
    'Stay inside one dramatic sequence as much as possible.',
    'Do not try to cover the person’s entire life.',
    'Do not list multiple landmarks, arrests, dates, or repeated examples unless they are essential.',
    'Use other facts only if they increase tension in the main incident.',
    'Do not write: He sold this. He sold that. He got arrested. He returned.',
    'Do not include every known fact.',
    'Imagine the story as 10 visual scenes.',
    'Each sentence should describe something the audience could see happening.',
    'Prefer actions over explanations.',
    'Focus on visible actions, human decisions, discoveries, mistakes, danger, conflict, survival, and consequences.',
    'Do not write isolated factual statements.',
    'Do not stack facts without dramatic connection.',
    'Do not write biography summaries.',
    'Do not narrate a timeline of events.',
    'Do not repeatedly start sentences with dates, years, or the same subject.',
    'Do not summarize events.',
    'Show events unfolding moment by moment.',
    'Present facts through actions and consequences.',
    'Whenever possible, show what people did, saw, believed, discovered, lost, or survived.',
    'Every sentence should cause the next sentence.',
    'Every sentence should answer one question while creating another.',
    'Connect events through clear cause and effect.',
    'Make each sentence pull the next sentence forward.',
    'Avoid sequences of unrelated factual statements.',
    'Build tension continuously.',
    'Every sentence must create curiosity, tension, surprise, danger, mystery, or consequence.',
    'Every 3 to 4 sentences should noticeably raise the stakes.',
    'Use specific names, places, and objects when known.',
    'Use dates only when they increase drama or are essential to understanding the event.',
    'Do not invent facts.',
    'Do not invent dates, prices, body counts, arrest counts, prison sentences, quotes, letters, diaries, police records, witnesses, documents, conversations, or final revelations.',
    'Only use specific details provided in the source material.',
    'If a detail is unknown, describe it generally.',
    'Structure the story naturally as hook, setup, escalation, discovery, consequence, and payoff.',
    'Delay the most important revelation until later in the story when possible.',
    'Do not mention viewers, narration, storytelling, content creation, or social media.',
    'If a sentence sounds like a Wikipedia article, rewrite it as a visual event.',
    'If a sentence only communicates information, rewrite it to include tension or consequence.',
    'Do not append modern-day examples, comparisons, lessons, morals, or commentary.',
    'The ending must emerge naturally from the story.',
    'End on the strongest verified consequence, mystery, irony, or twist already present in the source.',
    'The final 2 sentences must feel memorable and emotionally satisfying.',
    'Bad example: He became famous for the scam.',
    'Good example: Within weeks, strangers crossed the city looking for him.',
    'Bad example: Police became suspicious.',
    'Good example: Police officers started waiting beside the bridge entrances.',
    'Bad example: The scam fooled many people.',
    'Good example: Buyers arrived carrying documents they believed proved ownership.',
    'Bad example: He sold Grant’s Tomb, the Statue of Liberty, and City Hall.',
    'Good example: That morning, one buyer stood at the bridge believing it was his.',
    'Style example:',
    'A man claimed he owned a bridge.',
    'Nobody believed him.',
    'Then he produced official papers.',
    'Within hours, buyers handed over their savings.',
    'Weeks later, workers arrived to collect tolls.',
    'That was when police stopped them.',
    'The papers were fake.',
    'The money was gone.',
    'So was the man.',
    'Count the words before responding.',
  ].join(' ');
};

const createPromptGeneratorSystemMessage = () => {
  return [
    'Generate exactly 10 prompt pairs in valid JSON.',
    'Return only a JSON array with 10 objects and no markdown fences.',
    'Each object must have exactly two string keys: "imagePrompt" and "videoPrompt".',
    'The 10 prompt pairs must follow the narrative story line closely and progress from beginning to end in chronological order.',
    'Each imagePrompt must describe one single clear cinematic scene for a TikTok shorts visual sequence.',
    'Each imagePrompt must begin with style-first language and establish within the first 15 words that the scene is stylized 2D, illustrated, cel-shaded, graphic-novel, hand-drawn, and non-photorealistic.',
    'Always begin imagePrompt with phrases like "Stylized 2D comic-book illustration of", "Hand-drawn cel-shaded graphic-novel illustration of", or "Animated 2D cinematic comic-panel illustration of".',
    'Each videoPrompt must begin with exactly: "Animate the existing illustration without altering the original rendering style."',
    'Each videoPrompt must describe only movement, camera motion, and environmental motion using illustrated motion, stylized animated movement, limited-animation feel, 2D multiplane motion, and comic-book animation feel.',
    'Keep each videoPrompt grounded in the same scene and do not introduce new people, props, or locations that are not visible in the corresponding imagePrompt.',
    'Use concrete visual details from the narrative: locations, objects, actions, people, aftermath, and evidence when available.',
    'The output must remain fully illustrated and stylized across image generation and image-to-video generation.',
    'Never generate photorealistic, cinematic CGI, Pixar-style, Unreal Engine-style, or 3D-looking visuals.',
    'Do not use abstract narration language such as "the viewer", "this story", "the mystery deepens", or "history remembers".',
    'Never use these words or concepts in either prompt: photorealistic, hyper realistic, ultra detailed realism, movie still, realistic cinematic, realistic lighting, realistic shadows, volumetric fog, realistic particles, realistic skin, realistic cloth, physically based rendering, PBR, ray tracing, Unreal Engine, Octane render, live action, CGI realism.',
    'Strongly prefer these style words where relevant: stylized 2D, comic-book illustration, hand-drawn, cel-shaded, graphic novel, ink outlines, painted textures, flat shading, animated illustration, limited animation, multiplane animation, non-photorealistic, illustrated haze, painted snow streaks, stylized atmospheric effects.',
    'Do not include style boilerplate, camera-format boilerplate, safety boilerplate, numbering, commentary, or extra keys.',
    'Avoid graphic gore, hate, sexual content, brands, watermarks, copyrighted characters, and unsafe instructions.',
  ].join(' ');
};

const createSocialMetadataSystemMessage = () => {
  return [
    'Generate YouTube Shorts style SEO metadata in valid JSON.',
    'Return only one JSON object with exactly three keys: "title", "description", and "hashtags".',
    'The title must be between 40 and 60 characters total.',
    'The title must use a strong viral hook, feel emotionally compelling, and stay SEO-friendly.',
    'The description must be between 50 and 150 characters total.',
    'The description must be punchy, curiosity-driven, SEO-optimized, and clearly related to the narrative.',
    'The hashtags value must be a JSON array of exactly 5 unique hashtag strings.',
    'Each hashtag must begin with # and be relevant to the story, mystery, history, or true-event niche.',
    'Do not include #shorts in the model output because the application will add it automatically.',
    'Do not use markdown, explanations, labels, code fences, or extra keys.',
    'Avoid clickbait that feels fake. The hook should feel viral but still grounded in the story.',
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

  async generateSocialMetadataText({
    feedback,
    narrative,
    topic,
  }: SocialMetadataGenerationRequest): Promise<string> {
    const requestBody = {
      messages: [
        {
          role: 'system',
          content: createSocialMetadataSystemMessage(),
        },
        {
          role: 'user',
          content: [
            `Topic: ${topic ?? 'Unknown true story'}`,
            `Narrative: ${narrative}`,
            feedback ? `Revision notes: ${feedback}` : null,
          ].filter(Boolean).join('\n'),
        },
      ] satisfies PollinationsMessage[],
    };

    return requestTextViaMiniMax(env.minimaxNarrativeModel, requestBody);
  },
};
