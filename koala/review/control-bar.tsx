import {
  ActionIcon,
  Group,
  RingProgress,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconArchive,
  IconDoorExit,
  IconEdit,
  IconMicrophone,
  IconPlayerPlayFilled,
  IconPlayerSkipForwardFilled,
  IconPlayerStopFilled,
  IconLetterF,
} from "@tabler/icons-react";
import React from "react";
import { playAudio } from "../play-audio";
import { CardReviewProps } from "./types";
import { HOTKEYS } from "./hotkeys";

interface ControlBarProps extends CardReviewProps {
  currentStepUuid: string;
  isRecording: boolean;
  onRecordClick: () => void;
  onArchiveClick: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = (props) => {
  const {
    card,
    itemsComplete,
    totalItems,
    onSkip,
    onGiveUp,
    isRecording,
    onRecordClick,
    onArchiveClick,
  } = props;
  const progress = totalItems ? (itemsComplete / totalItems) * 100 : 0;

  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

  const handlePlayAudio = () => {
    if (card.termAudio) {
      playAudio(card.termAudio);
    }
  };

  return (
    <Group justify="center" wrap="wrap" gap="xs">
      <Tooltip label={`${itemsComplete} of ${totalItems} steps complete`}>
        <RingProgress
          size={44}
          thickness={4}
          sections={[{ value: progress, color: "pink.6" }]}
          label={
            <Text size="xs" ta="center">
              {Math.round(progress)}%
            </Text>
          }
        />
      </Tooltip>

      <Tooltip label={`Exit lesson`}>
        <ActionIcon
          component="a"
          href="/"
          variant="outline"
          size="lg"
          color="pink.7"
        >
          <IconDoorExit size={20} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={`Edit card (${HOTKEYS.EDIT})`}>
        <ActionIcon
          variant="outline"
          size="lg"
          onClick={openCardEditor}
          color="pink.7"
        >
          <IconEdit size={20} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={`Archive card (${HOTKEYS.ARCHIVE})`}>
        <ActionIcon
          variant="outline"
          size="lg"
          onClick={onArchiveClick}
          color="pink.7"
        >
          <IconArchive size={20} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={`Fail card (${HOTKEYS.FAIL})`}>
        <ActionIcon
          variant="outline"
          size="lg"
          onClick={() => onGiveUp(card.uuid)}
          color="pink.7"
        >
          <IconLetterF size={20} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={`Skip card (${HOTKEYS.SKIP})`}>
        <ActionIcon
          variant="outline"
          size="lg"
          onClick={() => onSkip(card.uuid)}
          color="pink.7"
        >
          <IconPlayerSkipForwardFilled size={20} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={`Play audio (${HOTKEYS.PLAY})`}>
        <ActionIcon
          variant="outline"
          size="lg"
          onClick={handlePlayAudio}
          color="pink.7"
        >
          <IconPlayerPlayFilled size={20} />
        </ActionIcon>
      </Tooltip>

      <Tooltip
        label={
          isRecording
            ? `Stop recording (${HOTKEYS.RECORD})`
            : `Record a response (${HOTKEYS.RECORD})`
        }
      >
        <ActionIcon
          variant={isRecording ? "filled" : "outline"}
          size="lg"
          onClick={onRecordClick}
          color="pink.7"
        >
          {isRecording ? (
            <IconPlayerStopFilled size={20} />
          ) : (
            <IconMicrophone size={20} />
          )}
        </ActionIcon>
      </Tooltip>
    </Group>
  );
};
