import {
  ActionIcon,
  Box,
  Group,
  Progress,
  Stack,
} from "@mantine/core";
import {
  IconArchive,
  IconEdit,
  IconPlayerSkipForwardFilled,
} from "@tabler/icons-react";
import React from "react";
import { ItemType, Quiz } from "./logic";
import RemixButton from "../remix-button"; // Adjusted path

type CardReviewProps = {
  onProceed: () => void;
  onSkip: (uuid: string) => void;
  itemsComplete: number;
  totalItems: number;
  itemType: ItemType;
  card: Quiz;
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

  const progressPercentage = props.totalItems
    ? (props.itemsComplete / props.totalItems) * 100
    : 0;

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
        aria-label={`${props.itemsComplete} of ${props.totalItems} cards complete.`}
      />
      <Group>
        <Group>
          <RemixButton
            card={{
              id: card.cardId,
              term: card.term,
              definition: card.definition,
            }}
          />
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => {
              props.onSkip(card.uuid);
            }}
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
