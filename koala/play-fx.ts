import { playAudio } from "./play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";

const CACHED_SOUNDS: Record<string, string> = {};

export const playFX = async (url: string): Promise<unknown> => {
  if (CACHED_SOUNDS[url]) {
    return await playAudio(CACHED_SOUNDS[url]);
  }
  //   Download WAV file:
  const response = await fetch(url);
  const blob = await response.blob();
  const wav = await convertBlobToWav(blob);
  const base64 = await blobToBase64(wav);
  CACHED_SOUNDS[url] = base64;
  return await playAudio(base64);
};
