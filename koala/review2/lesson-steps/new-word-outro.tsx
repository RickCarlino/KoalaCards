import { Stack, Text } from "@mantine/core";
import { CardUI } from "../types";

export const NewWordOutro: CardUI = ({ card }) => {
  return (
    <Stack align="center" gap="md">
      <Text>TODO: New Word</Text>
      <Text c="dimmed">Card: {card.uuid}</Text>
    </Stack>
  );
};
