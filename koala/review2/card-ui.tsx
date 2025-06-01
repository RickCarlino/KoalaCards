import { ActionIcon, Box, Group, Progress, Stack } from "@mantine/core";
import {
  IconArchive,
  IconEdit,
  IconPlayerSkipForwardFilled,
} from "@tabler/icons-react";
import React from "react";
import RemixButton from "../remix-button";
import { NewWordIntro } from "./lesson-steps/new-card-intro";
import { CardReviewProps, CardUI, ItemType } from "./types";

const placeholder =
  (label: string): CardUI =>
  ({ card }) => <div>{`TODO: ${label}: ${card.uuid}`}</div>;

const cardUIs: Record<ItemType, CardUI> = {
  newWordIntro: NewWordIntro,
  newWordOutro: placeholder("New Word Outro"),
  listening: placeholder("Listening"),
  speaking: placeholder("Speaking"),
  remedialIntro: placeholder("Remedial Intro"),
  remedialOutro: placeholder("Remedial Outro"),
  feedback: placeholder("Feedback"),
  pending: placeholder("Waiting on"),
};

const UnknownCard: CardUI = placeholder("Unknown Item Type");

export const CardReview: React.FC<CardReviewProps> = (props) => {
  const { card, itemType, itemsComplete, totalItems, onSkip } = props;

  const CardComponent = cardUIs[itemType] ?? UnknownCard;
  const progress = totalItems ? (itemsComplete / totalItems) * 100 : 0;

  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

  return (
    <Stack>
      <Progress
        value={progress}
        size="lg"
        radius="xs"
        color="teal"
        aria-label={`${itemsComplete} of ${totalItems} cards complete.`}
      />

      <Group justify="space-between">
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
            onClick={() => onSkip(card.uuid)}
            aria-label="Skip"
          >
            <IconPlayerSkipForwardFilled size={20} />
          </ActionIcon>

          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => console.log("Archive card:", card.uuid)}
            aria-label="Archive"
          >
            <IconArchive size={20} />
          </ActionIcon>
        </Group>

        <ActionIcon
          variant="subtle"
          size="lg"
          onClick={openCardEditor}
          aria-label="Edit"
        >
          <IconEdit size={20} />
        </ActionIcon>
      </Group>

      <Box>
        <CardComponent {...props} />
      </Box>
    </Stack>
  );
};
