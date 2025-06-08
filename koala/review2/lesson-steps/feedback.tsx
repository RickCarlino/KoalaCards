import { Stack, Text } from "@mantine/core";
import { CardUI } from "../types";

export const Feedback: CardUI = ({ card }) => {
  return (
    <Stack align="center" gap="md">
      <Text>TODO: Feedback</Text>
      <Text c="dimmed">Card: {card.uuid}</Text>
    </Stack>
  );
};