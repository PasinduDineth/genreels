export type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface NarrativeAsset {
  audioDurationInSeconds?: number;
  audioUrl?: string;
  text: string;
  wordCount: number;
}

export interface PromptItem {
  id: string;
  text: string;
}

export interface ImageAsset {
  id: string;
  promptId: string;
  promptText: string;
  url: string;
}

export interface VideoAsset {
  url: string;
  durationInSeconds?: number;
}

export interface StatusMessage {
  id: string;
  tone: 'info' | 'success' | 'error';
  message: string;
  timestamp: string;
}

export interface PromptGenerationRequest {
  narrative: string;
  topic: string;
}

export interface PromptGenerationResponse {
  narrative?: string;
  prompts: PromptItem[];
}

export interface NarrativeGenerationRequest {
  topic: string;
}

export interface NarrativeGenerationResponse {
  narrative: string;
  topic: string;
  wordCount: number;
}

export interface ImageGenerationRequest {
  prompts: string[];
}

export interface ImageGenerationResponse {
  images: ImageAsset[];
}

export interface VideoRenderRequest {
  audioDurationInSeconds?: number;
  audioUrl?: string;
  topic: string;
  images: ImageAsset[];
}

export interface VideoRenderResponse {
  video: VideoAsset;
}

export interface AppState {
  topic: string;
  narrative: NarrativeAsset | null;
  prompts: PromptItem[];
  images: ImageAsset[];
  video: VideoAsset | null;
  audioStatus: GenerationStatus;
  narrativeStatus: GenerationStatus;
  promptStatus: GenerationStatus;
  imageStatus: GenerationStatus;
  renderStatus: GenerationStatus;
  statusFeed: StatusMessage[];
}
