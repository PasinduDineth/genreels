import type {CSSProperties} from "react";
import {fitText} from "@remotion/layout-utils";
import {AbsoluteFill, useVideoConfig} from "remotion";
import type {TikTokPage} from "@remotion/captions";
import {BoldFont} from "../load-font";

const containerStyle: CSSProperties = {
  alignItems: "center",
  bottom: 350,
  height: 150,
  justifyContent: "center",
  top: undefined,
};

const DESIRED_FONT_SIZE = 130;
const FONT_COLOR = "#F7C615";
const STROKE_COLOR = "black";

export const CaptionPage = ({page}: {page: TikTokPage}) => {
  const {width} = useVideoConfig();
  const fittedText = fitText({
    fontFamily: BoldFont,
    text: page.text,
    textTransform: "uppercase",
    withinWidth: width * 0.9,
  });

  const fontSize = Math.min(DESIRED_FONT_SIZE, fittedText.fontSize);

  return (
    <AbsoluteFill style={containerStyle}>
      <div
        style={{
          color: FONT_COLOR,
          fontFamily: BoldFont,
          fontSize,
          paintOrder: "stroke",
          textTransform: "uppercase",
          WebkitTextStroke: `18px ${STROKE_COLOR}`,
        }}
      >
        {page.tokens.map((token) => {
          return (
            <span
              key={token.fromMs}
              style={{
                color: FONT_COLOR,
                display: "inline",
                whiteSpace: "pre",
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
