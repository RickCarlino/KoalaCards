import { Stack, Text } from "@mantine/core";
import { CardUI } from "../types";

export const RemedialIntro: CardUI = ({ card }) => {
  return (
    <Stack align="center" gap="md">
      <Text>TODO: Remedial Intro</Text>
      <Text c="dimmed">Card: {card.uuid}</Text>
    </Stack>
  );
};
