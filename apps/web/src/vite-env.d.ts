/// <reference types="vite/client" />

declare global {
  interface Window {
    puter?: {
      ai: {
        txt2speech: (
          text: string,
          options?: {
            provider?: string;
            model?: string;
            voice?: string;
            instructions?: string;
          },
        ) => Promise<HTMLAudioElement>;
      };
    };
  }
}

export {};
