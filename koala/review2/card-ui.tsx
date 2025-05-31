import React from "react";
import { ItemType, Quiz } from "./logic";
import {
  Box,
  Progress,
  Group,
  Button,
  Stack,
  ActionIcon,
} from "@mantine/core";
import {
  IconArchive,
  IconEdit,
  IconPlayerPauseFilled,
  IconPlayerSkipForwardFilled,
} from "@tabler/icons-react";

type CardReviewProps = {
  card: Quiz;
  itemType: ItemType;
  onProceed: () => void;
};

type CardUI = React.FC<CardReviewProps>;

const cardUIs: Record<ItemType, CardUI> = {
  newWordIntro: ({ card }) => <div>TODO: New Word Intro: {card.uuid}</div>,
  newWordOutro: ({ card }) => <div>TODO: New Word Outro: {card.uuid}</div>,
  listening: ({ card }) => <div>TODO: Listening: {card.uuid}</div>,
  speaking: ({ card }) => <div>TODO: Speaking: {card.uuid}</div>,
  remedialIntro: ({ card }) => (
    <div>TODO: Remedial Intro: {card.uuid}</div>
  ),
  remedialOutro: ({ card }) => (
    <div>TODO: Remedial Outro: {card.uuid}</div>
  ),
  feedback: ({ card }) => <div>TODO: Feedback: {card.uuid}</div>,
  pending: ({ card }) => <div>TODO: Waiting on: {card.uuid}</div>,
};

export const CardReview = (props: CardReviewProps) => {
  const { card, itemType }: CardReviewProps = props;
  const unknown = <div>TODO: Unknown Item Type: {card.uuid}</div>;
  const CardUI = cardUIs[itemType] || unknown;

  // Stub values for progress calculation
  const currentPosition = 0; // TODO: Get from review state
  const totalCards = 10; // TODO: Get from review state
  const progressPercentage = 25;

  const handleSkip = () => {
    console.log("Skip card:", card.uuid);
  };

  const handleRemix = () => {
    console.log("Remix card:", card.uuid);
  };

  const handleArchive = () => {
    console.log("Archive card:", card.uuid);
  };

  const handleEdit = (quiz: Quiz) => {
    const cardId = quiz.cardId;
    window.open(`/cards/${cardId}`, "_blank");
  };

  return (
    <Stack>
      <Progress
        value={progressPercentage}
        size="lg"
        radius="xs"
        color="teal"
        aria-label={`Progress: ${currentPosition} of ${totalCards} cards`}
      />
      <Group>
        <Group>
          <Button variant="subtle" size="sm" onClick={handleRemix}>
            Remix
          </Button>

          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={handleSkip}
            aria-label="Skip card"
          >
            <IconPlayerSkipForwardFilled size={20} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={handleArchive}
            aria-label="Skip card"
          >
            <IconArchive size={20} />
          </ActionIcon>
        </Group>
        <ActionIcon
          variant="subtle"
          size="lg"
          onClick={() => handleEdit(card)}
          aria-label="Edit card"
        >
          <IconEdit size={20} />
        </ActionIcon>
      </Group>
      <Box>
        <CardUI {...props} card={card} itemType={itemType} />
      </Box>
    </Stack>
  );
};
