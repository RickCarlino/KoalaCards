import { Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";

export function FailButton({ onClick }: { onClick: () => void }) {
  useHotkeys([["g", onClick]]);
  return (
    <Button variant="outline" color="red" onClick={onClick}>
      I Don't Know
    </Button>
  );
}
