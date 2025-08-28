import { playAudio } from "./play-audio";
import { blobToBase64 } from "@/koala/record-button";

const CACHED_SOUNDS: Record<string, string> = {};

export const playFX = async (url: string): Promise<unknown> => {
  if (CACHED_SOUNDS[url]) {
    return await playAudio(CACHED_SOUNDS[url]);
  }
  // Download audio file and convert to base64.
  const response = await fetch(url);
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  CACHED_SOUNDS[url] = base64;
  return await playAudio(base64);
};
