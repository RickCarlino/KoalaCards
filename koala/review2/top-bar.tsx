import { ActionIcon, Group, Progress } from "@mantine/core";
import {
  IconArchive,
  IconCircleFilled,
  IconEdit,
  IconPlayerPlayFilled,
  IconPlayerSkipForwardFilled,
} from "@tabler/icons-react";
import React from "react";
import { playAudio } from "../play-audio";
import RemixButton from "../remix-button";
import { CardReviewProps } from "./types";

export const TopBar: React.FC<CardReviewProps> = (props) => {
  const { card, itemsComplete, totalItems, onSkip } = props;

  const progress = totalItems ? (itemsComplete / totalItems) * 100 : 0;

  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

  const handlePlayAudio = () => {
    if (card.termAudio) {
      playAudio(card.termAudio);
    }
  };

  const handleRecord = () => {
    console.log("Record action for card:", card.uuid);
  };

  return (
    <>
      <Group justify="space-between">
        <Group>
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={handleRecord}
            aria-label="Record"
          >
            <IconCircleFilled size={24} />
          </ActionIcon>

          {card.termAudio && (
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={handlePlayAudio}
              aria-label="Play Audio"
            >
              <IconPlayerPlayFilled size={20} />
            </ActionIcon>
          )}
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
            onClick={openCardEditor}
            aria-label="Edit"
          >
            <IconEdit size={20} />
          </ActionIcon>

          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => console.log("Archive card:", card.uuid)}
            aria-label="Archive"
          >
            <IconArchive size={20} />
          </ActionIcon>
          <RemixButton
            card={{
              id: card.cardId,
              term: card.term,
              definition: card.definition,
            }}
          />
        </Group>
      </Group>
      <Progress
        value={progress}
        size="lg"
        radius="xs"
        color="teal"
        aria-label={`${itemsComplete} of ${totalItems} cards complete.`}
      />
    </>
  );
};
