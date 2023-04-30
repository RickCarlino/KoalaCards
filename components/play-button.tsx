import { Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useEffect } from "react";
import useSound from "use-sound";

/** A React component  */
export function PlayButton({ dataURI }: { dataURI?: string }) {
  if (!dataURI) {
    return (
      <>
        <Button disabled>▶️Loading...</Button>
      </>
    );
  }
  const [play , _controls] = useSound(dataURI);
  useHotkeys([["X", () => play()]]);
  useEffect(play, [_controls.sound]);
  return (
    <>
      <Button onClick={() => play()}>▶️Play Sentence (X)</Button>
    </>
  );
}
