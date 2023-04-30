import { Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useEffect } from "react";

export const playAudio = (dataURI: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!dataURI) {
      resolve();
    }

    const audio = new Audio(dataURI);
    audio.onended = () => resolve();
    audio.onerror = (e) => reject(e);
    audio.play();
  });
};

/** A React component  */
export function PlayButton({ dataURI }: { dataURI?: string }) {
  if (!dataURI) {
    return (
      <>
        <Button disabled>▶️Loading...</Button>
      </>
    );
  }
  const playSound = () => playAudio(dataURI);
  useHotkeys([["X", playSound]]);
  useEffect(() => {
    playSound();
  }, [dataURI]);
  return (
    <>
      <Button onClick={playSound}>▶️Play Sentence (X)</Button>
    </>
  );
}
