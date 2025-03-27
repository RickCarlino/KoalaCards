import { Button, Box } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { HOTKEYS } from "./hotkeys";

export function FailButton({ onClick }: { onClick: () => void }) {
  useHotkeys([[HOTKEYS.FAIL, onClick]]);
  return (
    <Box>
      <Button
        variant="outline"
        color="red"
        onClick={onClick}
        fullWidth
        size="md"
        h={45}
      >
        I Don't Know
      </Button>
    </Box>
  );
}
