import {useEffect, useMemo, useState} from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {createTikTokStyleCaptions} from "@remotion/captions";
import {
  DEFAULT_RENDER_INPUT,
  SceneMotion,
  type RenderInput,
} from "../lib/render-schema";
import {CaptionPage} from "../components/CaptionPage";
import {loadFont} from "../load-font";

const getMotionStyle = (
  motion: SceneMotion,
  frame: number,
  durationInFrames: number,
) => {
  const progress = frame / durationInFrames;

  switch (motion) {
    case "push-out":
      return {
        transform: `scale(${interpolate(progress, [0, 1], [1.12, 1.02])}) translate3d(0%, 0%, 0)`,
      };
    case "pan-left":
      return {
        transform: `scale(1.1) translate3d(${interpolate(progress, [0, 1], [6, -6])}%, 0%, 0)`,
      };
    case "pan-right":
      return {
        transform: `scale(1.1) translate3d(${interpolate(progress, [0, 1], [-6, 6])}%, 0%, 0)`,
      };
    case "drift-up":
      return {
        transform: `scale(1.08) translate3d(0%, ${interpolate(progress, [0, 1], [4, -4])}%, 0)`,
      };
    case "drift-down":
      return {
        transform: `scale(1.08) translate3d(0%, ${interpolate(progress, [0, 1], [-4, 4])}%, 0)`,
      };
    case "push-in":
    default:
      return {
        transform: `scale(${interpolate(progress, [0, 1], [1.02, 1.12])}) translate3d(0%, 0%, 0)`,
      };
  }
};

const fallbackInput = DEFAULT_RENDER_INPUT;

const normalizeCaptionForRender = (caption: RenderInput["captions"][number]) => {
  const timestampMs =
    typeof caption.timestampMs === "number" && Number.isFinite(caption.timestampMs)
      ? Math.max(caption.timestampMs, 0)
      : null;
  const startMs = timestampMs ?? Math.max(caption.startMs, 0);
  const endMs = Math.max(caption.endMs, startMs);

  return {
    ...caption,
    endMs,
    startMs,
  };
};

export const GenreelsSilentStory = ({
  audioUrl = fallbackInput.audioUrl,
  backgroundMusicUrl = fallbackInput.backgroundMusicUrl,
  backgroundMusicVolume,
  captions = fallbackInput.captions,
  scenes = fallbackInput.scenes,
}: RenderInput) => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  const [fontHandle] = useState(() => delayRender());
  const resolvedBackgroundMusicVolume = backgroundMusicVolume ?? fallbackInput.backgroundMusicVolume ?? 0.06;

  useEffect(() => {
    loadFont()
      .catch((error) => {
        console.error("Caption font loading failed", error);
      })
      .finally(() => {
        continueRender(fontHandle);
      });
  }, [fontHandle]);

  const captionPages = useMemo(() => {
    if (!captions.length) {
      return [];
    }

    return createTikTokStyleCaptions({
      captions: captions.map(normalizeCaptionForRender),
      combineTokensWithinMilliseconds: 200,
    }).pages;
  }, [captions]);

  return (
    <AbsoluteFill style={{backgroundColor: "#05070d"}}>
      {audioUrl ? <Audio src={audioUrl} /> : null}
      {backgroundMusicUrl ? (
        <Audio
          src={backgroundMusicUrl}
          loop
          volume={(currentFrame) => {
            const fadeIn = interpolate(currentFrame, [0, 20], [0, resolvedBackgroundMusicVolume], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const fadeOut = interpolate(
              currentFrame,
              [Math.max(durationInFrames - 30, 0), durationInFrames],
              [resolvedBackgroundMusicVolume, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );

            return Math.min(fadeIn, fadeOut, resolvedBackgroundMusicVolume);
          }}
        />
      ) : null}
      {scenes.map((scene, index) => {
        const sceneStart = Math.floor((index * durationInFrames) / scenes.length);
        const sceneEnd = Math.floor(((index + 1) * durationInFrames) / scenes.length);
        const sceneDurationInFrames = Math.max(sceneEnd - sceneStart, 1);
        const imageSrc = scene.imageUrl
          ? scene.imageUrl.startsWith("http") || scene.imageUrl.startsWith("data:image/")
            ? scene.imageUrl
            : staticFile(scene.imageUrl)
          : null;
        const videoSrc = scene.videoUrl
          ? scene.videoUrl.startsWith("http")
            ? scene.videoUrl
            : staticFile(scene.videoUrl)
          : null;

        return (
          <Sequence
            key={scene.id}
            from={sceneStart}
            durationInFrames={sceneDurationInFrames}
          >
            <SceneImage
              frame={frame - sceneStart}
              durationInFrames={sceneDurationInFrames}
              imageSrc={imageSrc}
              motion={scene.motion}
              videoDurationInSeconds={scene.videoDurationInSeconds}
              videoSrc={videoSrc}
            />
          </Sequence>
        );
      })}
      {captionPages.map((page, index) => {
        const nextPage = captionPages[index + 1] ?? null;
        const captionStartFrame = Math.max(0, Math.floor((page.startMs / 1000) * fps));
        const captionEndFrame = nextPage
          ? Math.ceil((nextPage.startMs / 1000) * fps)
          : durationInFrames;
        const captionDurationInFrames = Math.max(captionEndFrame - captionStartFrame, 1);

        return (
          <Sequence
            key={`${page.startMs}-${index}`}
            from={captionStartFrame}
            durationInFrames={captionDurationInFrames}
          >
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

type SceneImageProps = {
  durationInFrames: number;
  frame: number;
  imageSrc: string | null;
  motion: SceneMotion;
  videoDurationInSeconds?: number;
  videoSrc: string | null;
};

const getVideoPlaybackRate = ({
  fps,
  slotDurationInFrames,
  videoDurationInSeconds,
}: {
  fps: number;
  slotDurationInFrames: number;
  videoDurationInSeconds?: number;
}) => {
  if (
    typeof videoDurationInSeconds !== "number" ||
    !Number.isFinite(videoDurationInSeconds) ||
    videoDurationInSeconds <= 0
  ) {
    return 1;
  }

  const slotDurationInSeconds = slotDurationInFrames / fps;
  if (!Number.isFinite(slotDurationInSeconds) || slotDurationInSeconds <= 0) {
    return 1;
  }

  const playbackRate = videoDurationInSeconds / slotDurationInSeconds;

  // Slow clips down to fill their scene slot without freezing on a held frame.
  return Math.min(1, Math.max(playbackRate, 0.35));
};

const SceneImage = ({
  durationInFrames,
  frame,
  imageSrc,
  motion,
  videoDurationInSeconds,
  videoSrc,
}: SceneImageProps) => {
  const {fps} = useVideoConfig();
  const vignetteOpacity = interpolate(frame, [0, durationInFrames], [0.22, 0.36]);
  const fadeOpacity = interpolate(
    frame,
    [0, 8, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
  );
  const playbackRate = getVideoPlaybackRate({
    fps,
    slotDurationInFrames: durationInFrames,
    videoDurationInSeconds,
  });

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOpacity,
        overflow: "hidden",
      }}
    >
      {videoSrc ? (
        <OffthreadVideo
          muted
          playbackRate={playbackRate}
          src={videoSrc}
          style={{
            height: "100%",
            width: "100%",
            objectFit: "cover",
          }}
        />
      ) : imageSrc ? (
        <Img
          src={imageSrc}
          style={{
            height: "100%",
            width: "100%",
            objectFit: "cover",
            ...getMotionStyle(motion, frame, durationInFrames),
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)",
          opacity: vignetteOpacity,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(4,6,10,0.18) 0%, rgba(4,6,10,0.08) 45%, rgba(4,6,10,0.36) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
