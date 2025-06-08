import { Stack, Text } from "@mantine/core";
import { CardUI } from "../types";

export const Listening: CardUI = ({ card }) => {
  return (
    <Stack align="center" gap="md">
      <Text>TODO: Listening</Text>
      <Text c="dimmed">Card: {card.uuid}</Text>
    </Stack>
  );
};
