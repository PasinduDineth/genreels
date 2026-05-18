import {z} from "zod";

export const TOTAL_SCENES = 10;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;

export const sceneMotionValues = [
  "push-in",
  "push-out",
  "pan-left",
  "pan-right",
  "drift-up",
  "drift-down",
] as const;

export const SceneMotionSchema = z.enum(sceneMotionValues);
export type SceneMotion = z.infer<typeof SceneMotionSchema>;

export const RenderSceneSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  imageUrl: z.string().min(1),
  motion: SceneMotionSchema.default("push-in"),
});

export const RenderInputSchema = z.object({
  audioDurationInSeconds: z.number().positive().nullable().optional(),
  audioUrl: z.string().min(1).nullable().optional(),
  topic: z.string().min(1),
  scenes: z
    .array(RenderSceneSchema)
    .length(TOTAL_SCENES, `Exactly ${TOTAL_SCENES} scenes are required.`),
});

export type RenderScene = z.infer<typeof RenderSceneSchema>;
export type RenderInput = z.infer<typeof RenderInputSchema>;

const defaultMotions: SceneMotion[] = [
  "push-in",
  "pan-right",
  "drift-up",
  "push-out",
  "pan-left",
  "push-in",
  "drift-down",
  "pan-right",
  "push-out",
  "push-in",
];

export const DEFAULT_RENDER_INPUT: RenderInput = {
  audioDurationInSeconds: null,
  audioUrl: null,
  topic: "The Dyatlov Pass Incident",
  scenes: Array.from({length: TOTAL_SCENES}, (_, index) => ({
    id: `scene-${index + 1}`,
    prompt: `Scene ${index + 1} prompt placeholder for a historical mystery short`,
    imageUrl: `images/placeholder-${index + 1}.jpg`,
    motion: defaultMotions[index],
  })),
};

export const parseRenderInput = (input: unknown): RenderInput => {
  return RenderInputSchema.parse(input);
};
