import {continueRender, delayRender} from "remotion";

let loadPromise: Promise<void> | null = null;

export const loadFont = () => {
  if (loadPromise) {
    return loadPromise;
  }

  const handle = delayRender();

  loadPromise = Promise.all([
    new Promise<void>((resolve, reject) => {
      const link = document.createElement("link");
      link.href = "https://fonts.googleapis.com/css2?family=Bangers&display=swap";
      link.rel = "stylesheet";
      link.onload = () => resolve();
      link.onerror = () => reject(new Error("Failed to load Bangers font stylesheet."));
      document.head.appendChild(link);
    }),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 500);
    }),
  ])
    .then(() => {
      continueRender(handle);
    })
    .catch((err) => {
      console.error("Failed to load Bangers font", err);
      continueRender(handle);
    });

  return loadPromise;
};

export const BoldFont = "Bangers, cursive";
