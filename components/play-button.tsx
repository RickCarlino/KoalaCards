import { Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
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
  const [play /*, _controls*/] = useSound(dataURI);
  useHotkeys([
    ["X", () => play()]
  ])
  return (
    <>
      <Button onClick={() => play()}>▶️Play Sentence (X)</Button>
    </>
  );
}
