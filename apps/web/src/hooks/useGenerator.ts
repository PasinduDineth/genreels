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
  | {type: 'scene-video/status'; payload: GenerationStatus}
  | {type: 'render/status'; payload: GenerationStatus}
  | {type: 'narrative/set'; payload: NarrativeAsset | null}
  | {type: 'prompts/set'; payload: PromptItem[]}
  | {type: 'images/set'; payload: ImageAsset[]}
  | {type: 'image/update'; payload: ImageAsset}
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
  sceneVideoStatus: 'idle',
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
    case 'scene-video/status':
      return {
        ...state,
        sceneVideoStatus: action.payload,
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
    case 'image/update':
      return {
        ...state,
        images: state.images.map((image) =>
          image.id === action.payload.id ? action.payload : image,
        ),
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
        sceneVideoStatus: hasCompleteSceneVideoSet(action.payload.images) ? 'success' : 'idle',
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

const TARGET_SCENE_COUNT = 10;

const hasCompleteSceneSet = (images: ImageAsset[]) =>
  images.length === TARGET_SCENE_COUNT;

const hasCompleteSceneVideoSet = (images: ImageAsset[]) =>
  hasCompleteSceneSet(images) && images.every((image) => Boolean(image.videoUrl));

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
      state.sceneVideoStatus !== 'loading' &&
      state.renderStatus !== 'loading',
    [
      state.audioStatus,
      state.imageStatus,
      state.narrativeStatus,
      state.promptStatus,
      state.renderStatus,
      state.sceneVideoStatus,
      state.topic,
    ],
  );

  const canRender = useMemo(
    () =>
      hasCompleteSceneSet(state.images) &&
      state.audioStatus === 'success' &&
      state.renderStatus !== 'loading' &&
      state.imageStatus !== 'loading' &&
      state.sceneVideoStatus !== 'loading',
    [state.audioStatus, state.imageStatus, state.images, state.renderStatus, state.sceneVideoStatus],
  );

  const generateNarrativePromptsAndImages = useCallback(async () => {
    const topic = state.topic.trim();
    let phase: 'narrative' | 'audio' | 'prompts' | 'images' = 'narrative';

    if (!topic) {
      pushStatus('error', 'Add a topic before generating prompts.');
      return;
    }

    dispatch({type: 'status/clear'});
    dispatch({type: 'audio/status', payload: 'idle'});
    dispatch({type: 'narrative/status', payload: 'loading'});
    dispatch({type: 'prompts/status', payload: 'loading'});
    dispatch({type: 'images/status', payload: 'idle'});
    dispatch({type: 'scene-video/status', payload: 'idle'});
    dispatch({type: 'render/status', payload: 'idle'});
    dispatch({type: 'narrative/set', payload: null});
    dispatch({type: 'prompts/set', payload: []});
    dispatch({type: 'images/set', payload: []});
    dispatch({type: 'video/set', payload: null});
    pushStatus('info', 'Writing a short narrative from the topic.');

    try {
      const narrativeResponse = await apiClient.generateNarrative({topic});

      startTransition(() => {
        dispatch({
          type: 'narrative/set',
          payload: {
            text: narrativeResponse.narrative,
            wordCount: narrativeResponse.wordCount,
          },
        });
        dispatch({type: 'narrative/status', payload: 'success'});
        dispatch({type: 'audio/status', payload: 'loading'});
      });
      pushStatus('success', `Generated a ${narrativeResponse.wordCount}-word narrative.`);
      pushStatus('info', 'Generating narration audio and captions from the story.');

      phase = 'audio';
      const audioResponse = await apiClient.generateNarrationAudio({
        text: narrativeResponse.narrative,
        topic,
      });

      startTransition(() => {
        dispatch({
          type: 'narrative/set',
          payload: {
            audioDurationInSeconds: audioResponse.audioDurationInSeconds,
            audioUrl: audioResponse.audioUrl,
            captions: audioResponse.captions,
            text: narrativeResponse.narrative,
            wordCount: narrativeResponse.wordCount,
          },
        });
        dispatch({type: 'audio/status', payload: 'success'});
      });
      pushStatus('success', 'Narration audio and captions are ready.');

      pushStatus('info', 'Generating ten scene prompts from the narrative.');

      phase = 'prompts';
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

      phase = 'images';
      const imageResponse = await apiClient.generateImages({
        prompts: promptResponse.prompts,
      });

      startTransition(() => {
        dispatch({type: 'images/set', payload: imageResponse.images});
        dispatch({type: 'images/status', payload: 'success'});
      });
      pushStatus('success', `Generated ${imageResponse.images.length} images.`);
      pushStatus('info', 'Render video will now generate scene clips for all frames automatically before the final Remotion render.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected generation error.';

      if (phase === 'narrative') {
        dispatch({type: 'narrative/status', payload: 'error'});
        dispatch({type: 'audio/status', payload: 'idle'});
        dispatch({type: 'prompts/status', payload: 'idle'});
        dispatch({type: 'images/status', payload: 'idle'});
      } else if (phase === 'audio') {
        dispatch({type: 'audio/status', payload: 'error'});
        dispatch({type: 'prompts/status', payload: 'idle'});
        dispatch({type: 'images/status', payload: 'idle'});
      } else if (phase === 'prompts') {
        dispatch({type: 'prompts/status', payload: 'error'});
        dispatch({type: 'images/status', payload: 'idle'});
      } else {
        dispatch({type: 'images/status', payload: 'error'});
      }
      dispatch({type: 'scene-video/status', payload: 'idle'});
      pushStatus('error', message);
    }
  }, [pushStatus, state.topic]);

  const renderVideo = useCallback(async () => {
    if (!state.images.length) {
      pushStatus('error', 'Generate images before rendering the video.');
      return;
    }

    if (!hasCompleteSceneSet(state.images)) {
      pushStatus('error', `Generate all ${TARGET_SCENE_COUNT} scene images before rendering the video.`);
      return;
    }

    if (!state.narrative?.audioUrl) {
      pushStatus('error', 'Generate narration audio before rendering the final video.');
      return;
    }

    dispatch({type: 'scene-video/status', payload: 'loading'});
    dispatch({type: 'render/status', payload: 'loading'});
    let preparedImages = state.images;
    let sceneVideosReady = false;

    try {
      const scenesMissingVideo = preparedImages.filter((image) => !image.videoUrl);
      if (scenesMissingVideo.length > 0) {
        pushStatus(
          'info',
          `Generating MiniMax scene videos for ${scenesMissingVideo.length} frame${scenesMissingVideo.length === 1 ? '' : 's'} before the final render.`,
        );
      } else {
        pushStatus('info', 'All scene videos are already ready. Starting the final render.');
      }

      for (const [sceneIndex, image] of preparedImages.entries()) {
        if (image.videoUrl) {
          continue;
        }

        pushStatus('info', `Generating scene clip ${sceneIndex + 1}/${TARGET_SCENE_COUNT}.`);
        const response = await apiClient.generateSceneVideo({
          image,
          sceneIndex,
        });

        preparedImages = preparedImages.map((entry) =>
          entry.id === response.image.id ? response.image : entry,
        );

        startTransition(() => {
          dispatch({type: 'image/update', payload: response.image});
        });
      }

      sceneVideosReady = true;
      dispatch({type: 'scene-video/status', payload: 'success'});
      pushStatus('success', 'All scene videos are ready. Rendering the Remotion preview now.');

      const response = await apiClient.renderVideo({
        audioDurationInSeconds: state.narrative?.audioDurationInSeconds,
        audioUrl: state.narrative?.audioUrl,
        captions: state.narrative?.captions,
        topic: state.topic.trim(),
        images: preparedImages,
      });

      startTransition(() => {
        dispatch({type: 'video/set', payload: response.video});
        dispatch({type: 'render/status', payload: 'success'});
      });
      pushStatus('success', 'Video preview is ready.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected render error.';

      dispatch({type: 'scene-video/status', payload: sceneVideosReady ? 'success' : 'error'});
      dispatch({type: 'render/status', payload: 'error'});
      pushStatus('error', message);
    }
  }, [pushStatus, state.images, state.narrative, state.topic]);

  const downloadBundle = useCallback(async () => {
    if (!state.narrative || !state.images.length) {
      pushStatus('error', 'Generate or import a full story package before downloading a bundle.');
      return;
    }

    pushStatus('info', 'Packaging audio, images, scene videos, captions, prompts, and render metadata into a zip.');

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
      canDownloadBundle:
        Boolean(state.narrative?.audioUrl) &&
        state.prompts.length === TARGET_SCENE_COUNT &&
        hasCompleteSceneVideoSet(state.images),
      canGenerate,
      canRender,
    },
  };
}
