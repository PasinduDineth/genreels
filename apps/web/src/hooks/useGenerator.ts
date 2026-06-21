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
  SocialMetadataAsset,
  StatusMessage,
  VideoAsset,
} from '../types';

const createEmptyNarrative = (): NarrativeAsset => ({
  text: '',
  wordCount: 0,
});

type Action =
  | {type: 'topic/set'; payload: string}
  | {type: 'narrative/text-set'; payload: string}
  | {type: 'narrative/status'; payload: GenerationStatus}
  | {type: 'audio/status'; payload: GenerationStatus}
  | {type: 'social-metadata/status'; payload: GenerationStatus}
  | {type: 'prompts/status'; payload: GenerationStatus}
  | {type: 'images/status'; payload: GenerationStatus}
  | {type: 'scene-video/status'; payload: GenerationStatus}
  | {type: 'render/status'; payload: GenerationStatus}
  | {type: 'narrative/set'; payload: NarrativeAsset | null}
  | {type: 'social-metadata/set'; payload: SocialMetadataAsset | null}
  | {type: 'prompts/set'; payload: PromptItem[]}
  | {type: 'images/set'; payload: ImageAsset[]}
  | {type: 'image/update'; payload: ImageAsset}
  | {type: 'video/set'; payload: VideoAsset | null}
  | {type: 'bundle/load'; payload: BundleImportResponse}
  | {type: 'status/push'; payload: StatusMessage}
  | {type: 'status/clear'};

const initialState: AppState = {
  topic: 'The Dyatlov Pass incident',
  narrative: createEmptyNarrative(),
  socialMetadata: null,
  prompts: [],
  images: [],
  video: null,
  audioStatus: 'idle',
  narrativeStatus: 'idle',
  socialMetadataStatus: 'idle',
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
    case 'narrative/text-set':
      return {
        ...state,
        narrative: {
          ...state.narrative,
          text: action.payload,
          wordCount: action.payload.trim().split(/\s+/).filter(Boolean).length,
        },
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
    case 'social-metadata/status':
      return {
        ...state,
        socialMetadataStatus: action.payload,
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
    case 'social-metadata/set':
      return {
        ...state,
        socialMetadata: action.payload,
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
        socialMetadata: null,
        prompts: action.payload.prompts,
        images: action.payload.images,
        video: null,
        audioStatus: action.payload.narrative.audioUrl ? 'success' : 'idle',
        narrativeStatus: 'success',
        socialMetadataStatus: 'idle',
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

  const setNarrativeText = useCallback((value: string) => {
    dispatch({type: 'narrative/text-set', payload: value});
    dispatch({type: 'audio/status', payload: 'idle'});
    dispatch({type: 'social-metadata/status', payload: 'idle'});
    dispatch({type: 'prompts/status', payload: 'idle'});
    dispatch({type: 'images/status', payload: 'idle'});
    dispatch({type: 'scene-video/status', payload: 'idle'});
    dispatch({type: 'render/status', payload: 'idle'});
    dispatch({type: 'social-metadata/set', payload: null});
    dispatch({type: 'prompts/set', payload: []});
    dispatch({type: 'images/set', payload: []});
    dispatch({type: 'video/set', payload: null});
  }, []);

  const isBusy = useMemo(
    () =>
      state.audioStatus !== 'loading' &&
      state.narrativeStatus !== 'loading' &&
      state.socialMetadataStatus !== 'loading' &&
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
      state.socialMetadataStatus,
    ],
  );

  const canGenerateNarrative = useMemo(
    () => state.topic.trim().length > 0 && isBusy,
    [isBusy, state.topic],
  );

  const canGenerateAudio = useMemo(
    () => Boolean(state.narrative?.text.trim()) && isBusy,
    [isBusy, state.narrative?.text],
  );

  const canGenerateVideo = useMemo(
    () =>
      state.audioStatus === 'success' &&
      Boolean(state.narrative?.text.trim()) &&
      isBusy,
    [isBusy, state.audioStatus, state.narrative?.text],
  );

  const canGenerateSocialMetadata = useMemo(
    () => Boolean(state.narrative?.text.trim()) && isBusy,
    [isBusy, state.narrative?.text],
  );

  const generateNarrative = useCallback(async () => {
    const topic = state.topic.trim();

    if (!topic || !isBusy) {
      if (!topic) {
        pushStatus('error', 'Add a topic before generating the narrative.');
      }
      return;
    }

    dispatch({type: 'status/clear'});
    dispatch({type: 'audio/status', payload: 'idle'});
    dispatch({type: 'narrative/status', payload: 'loading'});
    dispatch({type: 'prompts/status', payload: 'loading'});
    dispatch({type: 'images/status', payload: 'idle'});
    dispatch({type: 'scene-video/status', payload: 'idle'});
    dispatch({type: 'render/status', payload: 'idle'});
    dispatch({type: 'social-metadata/status', payload: 'idle'});
    dispatch({type: 'narrative/set', payload: createEmptyNarrative()});
    dispatch({type: 'social-metadata/set', payload: null});
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
      });
      pushStatus('success', `Generated a ${narrativeResponse.wordCount}-word narrative.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected generation error.';

      dispatch({type: 'narrative/status', payload: 'error'});
      dispatch({type: 'audio/status', payload: 'idle'});
      dispatch({type: 'social-metadata/status', payload: 'idle'});
      dispatch({type: 'prompts/status', payload: 'idle'});
      dispatch({type: 'images/status', payload: 'idle'});
      dispatch({type: 'scene-video/status', payload: 'idle'});
      pushStatus('error', message);
    }
  }, [isBusy, pushStatus, state.topic]);

  const generateSocialMetadata = useCallback(async () => {
    const topic = state.topic.trim();
    const narrativeText = state.narrative?.text.trim() ?? '';

    if (!narrativeText || !isBusy) {
      if (!narrativeText) {
        pushStatus('error', 'Generate or enter a narrative before generating shorts metadata.');
      }
      return;
    }

    dispatch({type: 'social-metadata/status', payload: 'loading'});
    dispatch({type: 'social-metadata/set', payload: null});
    pushStatus('info', 'Generating SEO-friendly shorts title, description, and hashtags.');

    try {
      const response = await apiClient.generateSocialMetadata({
        narrative: narrativeText,
        topic,
      });

      startTransition(() => {
        dispatch({type: 'social-metadata/set', payload: response});
        dispatch({type: 'social-metadata/status', payload: 'success'});
      });
      pushStatus('success', 'Shorts metadata is ready to copy.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected social metadata generation error.';

      dispatch({type: 'social-metadata/status', payload: 'error'});
      pushStatus('error', message);
    }
  }, [isBusy, pushStatus, state.narrative?.text, state.topic]);

  const generateAudio = useCallback(async () => {
    const topic = state.topic.trim();
    const narrativeText = state.narrative?.text.trim() ?? '';

    if (!narrativeText || !isBusy) {
      if (!narrativeText) {
        pushStatus('error', 'Generate or enter a narrative before generating audio.');
      }
      return;
    }

    dispatch({type: 'audio/status', payload: 'loading'});
    dispatch({type: 'prompts/status', payload: 'idle'});
    dispatch({type: 'images/status', payload: 'idle'});
    dispatch({type: 'scene-video/status', payload: 'idle'});
    dispatch({type: 'render/status', payload: 'idle'});
    dispatch({type: 'social-metadata/status', payload: 'idle'});
    dispatch({type: 'prompts/set', payload: []});
    dispatch({type: 'images/set', payload: []});
    dispatch({type: 'video/set', payload: null});
    pushStatus('info', 'Generating narration audio and captions from the edited story.');

    try {
      const audioResponse = await apiClient.generateNarrationAudio({
        text: narrativeText,
        topic,
      });

      startTransition(() => {
        dispatch({
          type: 'narrative/set',
          payload: {
            audioDurationInSeconds: audioResponse.audioDurationInSeconds,
            audioUrl: audioResponse.audioUrl,
            captions: audioResponse.captions,
            text: narrativeText,
            wordCount: narrativeText.split(/\s+/).filter(Boolean).length,
          },
        });
        dispatch({type: 'audio/status', payload: 'success'});
      });
      pushStatus('success', 'Narration audio and captions are ready.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected audio generation error.';

      dispatch({type: 'audio/status', payload: 'error'});
      pushStatus('error', message);
    }
  }, [isBusy, pushStatus, state.narrative?.text, state.topic]);

  const renderVideo = useCallback(async () => {
    const topic = state.topic.trim();
    const narrativeText = state.narrative?.text.trim() ?? '';
    let phase: 'prompts' | 'images' | 'scene-videos' | 'render' = 'prompts';

    if (!narrativeText) {
      pushStatus('error', 'Generate or enter a narrative before generating the video.');
      return;
    }

    if (!state.narrative?.audioUrl) {
      pushStatus('error', 'Generate narration audio before generating the video.');
      return;
    }

    if (!isBusy) {
      return;
    }

    dispatch({type: 'prompts/status', payload: 'loading'});
    dispatch({type: 'images/status', payload: 'idle'});
    dispatch({type: 'scene-video/status', payload: 'idle'});
    dispatch({type: 'render/status', payload: 'idle'});
    dispatch({type: 'prompts/set', payload: []});
    dispatch({type: 'images/set', payload: []});
    dispatch({type: 'video/set', payload: null});
    pushStatus('info', 'Generating ten scene prompts from the approved narrative.');

    let preparedImages = state.images;
    let sceneVideosReady = false;

    try {
      const promptResponse = await apiClient.generatePrompts({
        narrative: narrativeText,
        topic,
      });

      phase = 'images';
      startTransition(() => {
        dispatch({type: 'prompts/set', payload: promptResponse.prompts});
        dispatch({type: 'prompts/status', payload: 'success'});
        dispatch({type: 'images/status', payload: 'loading'});
      });
      pushStatus('success', `Generated ${promptResponse.prompts.length} prompts.`);
      pushStatus('info', 'Generating images from the approved prompts.');

      const imageResponse = await apiClient.generateImages({
        prompts: promptResponse.prompts,
      });

      preparedImages = imageResponse.images;
      phase = 'scene-videos';
      startTransition(() => {
        dispatch({type: 'images/set', payload: imageResponse.images});
        dispatch({type: 'images/status', payload: 'success'});
      });
      pushStatus('success', `Generated ${imageResponse.images.length} images.`);

      dispatch({type: 'scene-video/status', payload: 'loading'});
      dispatch({type: 'render/status', payload: 'loading'});
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

      phase = 'render';
      const response = await apiClient.renderVideo({
        audioDurationInSeconds: state.narrative?.audioDurationInSeconds,
        audioUrl: state.narrative?.audioUrl,
        captions: state.narrative?.captions,
        topic,
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

      if (phase === 'prompts') {
        dispatch({type: 'prompts/status', payload: 'error'});
        dispatch({type: 'images/status', payload: 'idle'});
        dispatch({type: 'scene-video/status', payload: 'idle'});
        dispatch({type: 'render/status', payload: 'idle'});
      } else if (phase === 'images') {
        dispatch({type: 'images/status', payload: 'error'});
        dispatch({type: 'scene-video/status', payload: 'idle'});
        dispatch({type: 'render/status', payload: 'idle'});
      } else if (phase === 'scene-videos') {
        dispatch({type: 'scene-video/status', payload: sceneVideosReady ? 'success' : 'error'});
        dispatch({type: 'render/status', payload: 'error'});
      } else {
        dispatch({type: 'scene-video/status', payload: 'success'});
        dispatch({type: 'render/status', payload: 'error'});
      }
      pushStatus('error', message);
    }
  }, [isBusy, pushStatus, state.images, state.narrative, state.topic]);

  const downloadBundle = useCallback(async () => {
    if (!state.narrative?.text.trim()) {
      pushStatus('error', 'Generate or import at least a narrative before downloading a bundle.');
      return;
    }

    pushStatus('info', 'Packaging the current topic, narrative, prompts, images, optional scene videos, and render metadata into a zip.');

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
      generateAudio,
      generateNarrative,
      generateSocialMetadata,
      importBundle,
      renderVideo,
      setNarrativeText,
      setTopic,
    },
    derived: {
      canDownloadBundle: Boolean(state.narrative?.text.trim()),
      canGenerateAudio,
      canGenerateNarrative,
      canGenerateSocialMetadata,
      canGenerateVideo,
    },
  };
}
