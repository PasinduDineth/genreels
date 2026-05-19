import {useEffect, useMemo, useState} from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
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

export const GenreelsSilentStory = ({
  audioUrl = fallbackInput.audioUrl,
  captions = fallbackInput.captions,
  scenes = fallbackInput.scenes,
}: RenderInput) => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  const [fontHandle] = useState(() => delayRender());

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
      captions,
      combineTokensWithinMilliseconds: 200,
    }).pages;
  }, [captions]);

  return (
    <AbsoluteFill style={{backgroundColor: "#05070d"}}>
      {audioUrl ? <Audio src={audioUrl} /> : null}
      {scenes.map((scene, index) => {
        const sceneStart = Math.floor((index * durationInFrames) / scenes.length);
        const sceneEnd = Math.floor(((index + 1) * durationInFrames) / scenes.length);
        const sceneDurationInFrames = Math.max(sceneEnd - sceneStart, 1);
        const imageSrc = scene.imageUrl.startsWith("http") || scene.imageUrl.startsWith("data:image/")
          ? scene.imageUrl
          : staticFile(scene.imageUrl);

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
  imageSrc: string;
  motion: SceneMotion;
};

const SceneImage = ({
  durationInFrames,
  frame,
  imageSrc,
  motion,
}: SceneImageProps) => {
  const vignetteOpacity = interpolate(frame, [0, durationInFrames], [0.22, 0.36]);
  const fadeOpacity = interpolate(
    frame,
    [0, 8, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
  );

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOpacity,
        overflow: "hidden",
      }}
    >
      <Img
        src={imageSrc}
        style={{
          height: "100%",
          width: "100%",
          objectFit: "cover",
          ...getMotionStyle(motion, frame, durationInFrames),
        }}
      />
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
