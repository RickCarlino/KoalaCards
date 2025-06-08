import { playAudio } from "@/koala/play-audio";
import { Stack, Text, Image } from "@mantine/core";
import { CardUI } from "../types";
import { useEffect } from "react";

export const NewWordIntro: CardUI = ({ card, recordings }) => {
  const { term, definition, uuid } = card;

  const recordingStatus = !!recordings?.[uuid];

  useEffect(() => {
    if (card.termAudio) {
      playAudio(card.termAudio);
    }
  }, [card.termAudio]);

  return (
    <Stack align="center" gap="md">
      {card.imageURL && (
        <Image
          src={card.imageURL}
          alt={`Image: ${term}`}
          maw="100%"
          mah={240}
          fit="contain"
        />
      )}
      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>
      <Text ta="center">{definition}</Text>
      <Text ta="center">
        {recordingStatus ? "Have a recording" : "No recording available"}
      </Text>
    </Stack>
  );
};
