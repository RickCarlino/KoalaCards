import { Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useEffect } from "react";

export const createPlayer = (dataURI: string): [() => void, string] => {
  if (!dataURI) {
    return [() => {}, dataURI ?? ""];
  }

  return [() => {
    const audio = new Audio(dataURI);
    // audio.playbackRate = 1;
    // audio.volume = 1;
    audio.play();
  }, dataURI];
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
  const [play, sound] = createPlayer(dataURI);
  useHotkeys([["X", () => play()]]);
  useEffect(() => play(), [sound]);
  return (
    <>
      <Button onClick={() => play()}>▶️Play Sentence (X)</Button>
    </>
  );
}
