import { ActionIcon, Box, Group, Progress, Stack } from "@mantine/core";
import {
  IconArchive,
  IconEdit,
  IconPlayerSkipForwardFilled,
} from "@tabler/icons-react";
import React from "react";
import RemixButton from "../remix-button";
import { Feedback } from "./lesson-steps/feedback";
import { Listening } from "./lesson-steps/listening";
import { NewWordIntro } from "./lesson-steps/new-card-intro";
import { NewWordOutro } from "./lesson-steps/new-word-outro";
import { Pending } from "./lesson-steps/pending";
import { RemedialIntro } from "./lesson-steps/remedial-intro";
import { RemedialOutro } from "./lesson-steps/remedial-outro";
import { Speaking } from "./lesson-steps/speaking";
import { CardReviewProps, CardUI, ItemType } from "./types";

const cardUIs: Record<ItemType, CardUI> = {
  newWordIntro: NewWordIntro,
  newWordOutro: NewWordOutro,
  listening: Listening,
  speaking: Speaking,
  remedialIntro: RemedialIntro,
  remedialOutro: RemedialOutro,
  feedback: Feedback,
  pending: Pending,
};

const UnknownCard: CardUI = ({ card }) => (
  <div>{`UNKNOWN CARD TYPE: ${card.uuid}`}</div>
);

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
