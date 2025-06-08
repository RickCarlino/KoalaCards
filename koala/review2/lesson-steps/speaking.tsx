import { Stack, Text } from "@mantine/core";
import { CardUI } from "../types";

export const Speaking: CardUI = ({ card }) => {
  return (
    <Stack align="center" gap="md">
      <Text>TODO: Remedial Outro</Text>
      <Text c="dimmed">Card: {card.uuid}</Text>
    </Stack>
  );
};
