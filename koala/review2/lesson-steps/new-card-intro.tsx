import { playAudio } from "@/koala/play-audio";
import { Stack, Group, Button, Text, Image } from "@mantine/core";
import { CardUI } from "../types";
import { useEffect } from "react";

// Skeleton UI for NewWordIntro
export const NewWordIntro: CardUI = ({ card }) => {
  // Assume card structure based on documentation.
  // Actual fields might be card.term, card.definition, card.image_url, card.audio_url from Zod schema.
  // Using 'as any' and default values for skeleton purposes.
  const {
    term = "Placeholder Term",
    definition = "Placeholder Definition",
  } = card;

  const handleRecord = () => {
    console.log("Record action for card:", card.uuid);
    // TODO: Integrate with actual recording logic.
    // This might involve setting state, calling a hook, etc.
    // For now, this is a placeholder.
  };

  const handlePlayAudio = () => {
    playAudio(card.termAudio);
  };

  useEffect(() => {
    if (card.termAudio) {
      playAudio(card.termAudio);
    }
  }, [card.termAudio]); // Play audio when card.termAudio changes or on initial load

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
      <Group justify="center" mt="md">
        {card.termAudio && (
          <Button variant="outline" onClick={handlePlayAudio}>
            Play Audio
          </Button>
        )}
        {/* TODO: Replace with actual RecordButton component if available */}
        <Button color="blue" onClick={handleRecord}>
          Record Response
        </Button>
      </Group>
    </Stack>
  );
};
