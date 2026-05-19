import {
  startTransition,
  useCallback,
  useMemo,
  useReducer,
} from 'react';
import {apiClient} from '../lib/api';
import type {
  AppState,
  BundleImportResponse,
  GenerationStatus,
  ImageAsset,
  NarrativeAsset,
  PromptItem,
  StatusMessage,
  VideoAsset,
} from '../types';

type Action =
  | {type: 'topic/set'; payload: string}
  | {type: 'narrative/status'; payload: GenerationStatus}
  | {type: 'audio/status'; payload: GenerationStatus}
  | {type: 'prompts/status'; payload: GenerationStatus}
  | {type: 'images/status'; payload: GenerationStatus}
  | {type: 'render/status'; payload: GenerationStatus}
  | {type: 'narrative/set'; payload: NarrativeAsset | null}
  | {type: 'prompts/set'; payload: PromptItem[]}
  | {type: 'images/set'; payload: ImageAsset[]}
  | {type: 'video/set'; payload: VideoAsset | null}
  | {type: 'bundle/load'; payload: BundleImportResponse}
  | {type: 'status/push'; payload: StatusMessage}
  | {type: 'status/clear'};

const initialState: AppState = {
  topic: 'The Dyatlov Pass incident',
  narrative: null,
  prompts: [],
  images: [],
  video: null,
  audioStatus: 'idle',
  narrativeStatus: 'idle',
  promptStatus: 'idle',
  imageStatus: 'idle',
  renderStatus: 'idle',
  statusFeed: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'topic/set':
      return {
        ...state,
        topic: action.payload,
      };
    case 'narrative/status':
      return {
        ...state,
        narrativeStatus: action.payload,
      };
    case 'audio/status':
      return {
        ...state,
        audioStatus: action.payload,
      };
    case 'prompts/status':
      return {
        ...state,
        promptStatus: action.payload,
      };
    case 'images/status':
      return {
        ...state,
        imageStatus: action.payload,
      };
    case 'render/status':
      return {
        ...state,
        renderStatus: action.payload,
      };
    case 'narrative/set':
      return {
        ...state,
        narrative: action.payload,
      };
    case 'prompts/set':
      return {
        ...state,
        prompts: action.payload,
      };
    case 'images/set':
      return {
        ...state,
        images: action.payload,
      };
    case 'video/set':
      return {
        ...state,
        video: action.payload,
      };
    case 'bundle/load':
      return {
        ...state,
        topic: action.payload.topic,
        narrative: action.payload.narrative,
        prompts: action.payload.prompts,
        images: action.payload.images,
        video: null,
        audioStatus: action.payload.narrative.audioUrl ? 'success' : 'idle',
        narrativeStatus: 'success',
        promptStatus: action.payload.prompts.length ? 'success' : 'idle',
        imageStatus: action.payload.images.length ? 'success' : 'idle',
        renderStatus: 'idle',
      };
    case 'status/push':
      return {
        ...state,
        statusFeed: [action.payload, ...state.statusFeed].slice(0, 8),
      };
    case 'status/clear':
      return {
        ...state,
        statusFeed: [],
      };
    default:
      return state;
  }
}

function buildStatusMessage(
  tone: StatusMessage['tone'],
  message: string,
): StatusMessage {
  return {
    id: crypto.randomUUID(),
    tone,
    message,
    timestamp: new Date().toLocaleTimeString(),
  };
}

export function useGenerator() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const pushStatus = useCallback((tone: StatusMessage['tone'], message: string) => {
    dispatch({
      type: 'status/push',
      payload: buildStatusMessage(tone, message),
    });
  }, []);

  const setTopic = useCallback((value: string) => {
    dispatch({type: 'topic/set', payload: value});
  }, []);

  const canGenerate = useMemo(
    () =>
      state.topic.trim().length > 0 &&
      state.audioStatus !== 'loading' &&
      state.narrativeStatus !== 'loading' &&
      state.promptStatus !== 'loading' &&
      state.imageStatus !== 'loading' &&
      state.renderStatus !== 'loading',
    [state.audioStatus, state.imageStatus, state.narrativeStatus, state.promptStatus, state.renderStatus, state.topic],
  );

  const canRender = useMemo(
    () =>
      state.images.length > 0 &&
      state.renderStatus !== 'loading' &&
      state.imageStatus !== 'loading',
    [state.imageStatus, state.images.length, state.renderStatus],
  );

  const generateNarrativePromptsAndImages = useCallback(async () => {
    const topic = state.topic.trim();

    if (!topic) {
      pushStatus('error', 'Add a topic before generating prompts.');
      return;
    }

    dispatch({type: 'status/clear'});
    dispatch({type: 'audio/status', payload: 'loading'});
    dispatch({type: 'narrative/status', payload: 'loading'});
    dispatch({type: 'prompts/status', payload: 'loading'});
    dispatch({type: 'images/status', payload: 'idle'});
    dispatch({type: 'render/status', payload: 'idle'});
    dispatch({type: 'narrative/set', payload: null});
    dispatch({type: 'prompts/set', payload: []});
    dispatch({type: 'images/set', payload: []});
    dispatch({type: 'video/set', payload: null});
    pushStatus('info', 'Writing a short narrative from the topic.');

    try {
      const narrativeResponse = await apiClient.generateNarrative({topic});
      pushStatus('info', 'Generating voice narration from the story.');

      if (!window.puter?.ai?.txt2speech) {
        throw new Error('Puter TTS is not available in the browser.');
      }

      const audioElement = await window.puter.ai.txt2speech(narrativeResponse.narrative, {
        provider: 'gemini',
        model: 'gemini-2.5-flash-preview-tts',
        voice: 'Algieba',
        instructions: 'danger narrative for viral tiktok videos',
      });
      await new Promise<void>((resolve, reject) => {
        if (Number.isFinite(audioElement.duration) && audioElement.duration > 0) {
          resolve();
          return;
        }

        const handleLoadedMetadata = () => {
          cleanup();
          resolve();
        };

        const handleError = () => {
          cleanup();
          reject(new Error('Failed to read Puter audio metadata.'));
        };

        const cleanup = () => {
          audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audioElement.removeEventListener('error', handleError);
        };

        audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        audioElement.addEventListener('error', handleError);
      });

      const audioResponse = await fetch(audioElement.src);
      const audioBlob = await audioResponse.blob();
      const uploadedAudio = await apiClient.uploadNarrationAudio(topic, audioBlob);

      startTransition(() => {
        dispatch({
          type: 'narrative/set',
          payload: {
            audioDurationInSeconds: audioElement.duration,
            audioUrl: uploadedAudio.audioUrl,
            captions: uploadedAudio.captions,
            text: narrativeResponse.narrative,
            wordCount: narrativeResponse.wordCount,
          },
        });
        dispatch({type: 'narrative/status', payload: 'success'});
        dispatch({type: 'audio/status', payload: 'success'});
      });
      pushStatus('success', `Generated a ${narrativeResponse.wordCount}-word narrative.`);
      pushStatus('success', `Generated narration audio (${Math.round(audioElement.duration)}s).`);

      pushStatus('info', 'Generating ten scene prompts from the narrative.');

      const promptResponse = await apiClient.generatePrompts({
        narrative: narrativeResponse.narrative,
        topic,
      });

      startTransition(() => {
        dispatch({type: 'prompts/set', payload: promptResponse.prompts});
        dispatch({type: 'prompts/status', payload: 'success'});
      });
      pushStatus('success', `Generated ${promptResponse.prompts.length} prompts.`);

      dispatch({type: 'images/status', payload: 'loading'});
      pushStatus('info', 'Generating images from the approved prompts.');

      const imageResponse = await apiClient.generateImages({
        prompts: promptResponse.prompts.map((prompt) => prompt.text),
      });

      startTransition(() => {
        dispatch({type: 'images/set', payload: imageResponse.images});
        dispatch({type: 'images/status', payload: 'success'});
      });
      pushStatus('success', `Generated ${imageResponse.images.length} images.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected generation error.';

      dispatch({type: 'audio/status', payload: 'error'});
      dispatch({type: 'narrative/status', payload: 'error'});
      dispatch({type: 'prompts/status', payload: 'error'});
      dispatch({type: 'images/status', payload: 'error'});
      pushStatus('error', message);
    }
  }, [pushStatus, state.topic]);

  const renderVideo = useCallback(async () => {
    if (!state.images.length) {
      pushStatus('error', 'Generate images before rendering the video.');
      return;
    }

    dispatch({type: 'render/status', payload: 'loading'});
    pushStatus('info', 'Rendering the Remotion video preview.');

    try {
      const response = await apiClient.renderVideo({
        audioDurationInSeconds: state.narrative?.audioDurationInSeconds,
        audioUrl: state.narrative?.audioUrl,
        captions: state.narrative?.captions,
        topic: state.topic.trim(),
        images: state.images,
      });

      startTransition(() => {
        dispatch({type: 'video/set', payload: response.video});
        dispatch({type: 'render/status', payload: 'success'});
      });
      pushStatus('success', 'Video preview is ready.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected render error.';

      dispatch({type: 'render/status', payload: 'error'});
      pushStatus('error', message);
    }
  }, [pushStatus, state.images, state.narrative, state.topic]);

  const downloadBundle = useCallback(async () => {
    if (!state.narrative || !state.images.length) {
      pushStatus('error', 'Generate or import a full story package before downloading a bundle.');
      return;
    }

    pushStatus('info', 'Packaging audio, images, captions, prompts, and render metadata into a zip.');

    try {
      const {blob, fileName} = await apiClient.exportBundle({
        images: state.images,
        narrative: state.narrative,
        prompts: state.prompts,
        topic: state.topic.trim(),
      });

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);

      pushStatus('success', `Downloaded bundle: ${fileName}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected bundle export error.';

      pushStatus('error', message);
    }
  }, [pushStatus, state.images, state.narrative, state.prompts, state.topic]);

  const importBundle = useCallback(async (bundleFile: File) => {
    pushStatus('info', `Importing bundle: ${bundleFile.name}`);

    try {
      const response = await apiClient.importBundle(bundleFile);

      startTransition(() => {
        dispatch({type: 'bundle/load', payload: response});
      });

      pushStatus('success', 'Bundle imported. You can render the video immediately.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected bundle import error.';

      pushStatus('error', message);
    }
  }, [pushStatus]);

  return {
    state,
    actions: {
      downloadBundle,
      generateNarrativePromptsAndImages,
      importBundle,
      renderVideo,
      setTopic,
    },
    derived: {
      canDownloadBundle: Boolean(state.narrative && state.images.length === 10),
      canGenerate,
      canRender,
    },
  };
}
