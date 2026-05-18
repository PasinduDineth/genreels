import {Composition} from "remotion";
import {
  DEFAULT_RENDER_INPUT,
  TOTAL_SCENES,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./lib/render-schema";
import {GenreelsSilentStory} from "./compositions/GenreelsSilentStory";

export const RemotionRoot = () => {
  const defaultDurationInFrames = DEFAULT_RENDER_INPUT.audioDurationInSeconds
    ? Math.ceil(DEFAULT_RENDER_INPUT.audioDurationInSeconds * VIDEO_FPS)
    : 90 * TOTAL_SCENES;

  return (
    <>
      <Composition
        id="GenreelsSilentStory"
        component={GenreelsSilentStory}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={VIDEO_FPS}
        durationInFrames={defaultDurationInFrames}
        defaultProps={DEFAULT_RENDER_INPUT}
        calculateMetadata={({props}) => {
          const audioDurationInSeconds =
            typeof props.audioDurationInSeconds === "number" && Number.isFinite(props.audioDurationInSeconds)
              ? props.audioDurationInSeconds
              : null;

          return {
            durationInFrames: audioDurationInSeconds
              ? Math.ceil(audioDurationInSeconds * VIDEO_FPS)
              : 90 * TOTAL_SCENES,
          };
        }}
      />
    </>
  );
};
