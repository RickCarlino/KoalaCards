import { Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { HOTKEYS } from "./hotkeys";

export function FailButton({ onClick }: { onClick: () => void }) {
  useHotkeys([[HOTKEYS.FAIL, onClick]]);
  return (
    <Button variant="outline" color="red" onClick={onClick}>
      I Don't Know
    </Button>
  );
}
