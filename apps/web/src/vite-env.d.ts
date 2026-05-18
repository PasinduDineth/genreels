/// <reference types="vite/client" />

declare global {
  interface Window {
    puter?: {
      ai: {
        txt2speech: (
          text: string,
          options?: {
            provider?: string;
            voice?: string;
          },
        ) => Promise<HTMLAudioElement>;
      };
    };
  }
}

export {};
