import { Stack, Text } from "@mantine/core";
import { CardUI } from "../types";

export const Pending: CardUI = ({ card }) => {
  return (
    <Stack align="center" gap="md">
      <Text>TODO: Pending</Text>
      <Text c="dimmed">Card: {card.uuid}</Text>
    </Stack>
  );
};