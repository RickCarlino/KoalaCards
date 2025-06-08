import { ActionIcon, Group, Progress } from "@mantine/core";
import {
  IconArchive,
  IconCircleFilled,
  IconEdit,
  IconPlayerPlayFilled,
  IconPlayerSkipForwardFilled,
  IconPlayerStopFilled,
} from "@tabler/icons-react";
import React from "react";
import { playAudio } from "../play-audio";
import RemixButton from "../remix-button";
import { CardReviewProps } from "./types";
import { useVoiceRecorder } from "../use-recorder";
import { blobToBase64, convertBlobToWav } from "../record-button";

interface TopBarProps extends CardReviewProps {
  onRecordingComplete?: (base64: string) => void;
}

export const TopBar: React.FC<TopBarProps> = (props) => {
  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

  const handlePlayAudio = () => {
    if (card.termAudio) {
      playAudio(card.termAudio);
    }
  };

  const handleRecordingResult = async (blob: Blob) => {
    if (props.onRecordingComplete) {
      const wav = await convertBlobToWav(blob);
      const base64 = await blobToBase64(wav);
      props.onRecordingComplete(base64);
    }
  };

  const { card, itemsComplete, totalItems, onSkip } = props;

  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  const handleRecordClick = () => {
    if (voiceRecorder.isRecording) {
      voiceRecorder.stop();
    } else {
      voiceRecorder.start();
    }
  };
  const progress = totalItems ? (itemsComplete / totalItems) * 100 : 0;

  return (
    <>
      <Group justify="space-between">
        <Group>
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={handleRecordClick}
            aria-label={
              voiceRecorder.isRecording
                ? "Stop Recording"
                : "Start Recording"
            }
            color={voiceRecorder.isRecording ? "red" : undefined}
          >
            {voiceRecorder.isRecording ? (
              <IconPlayerStopFilled size={24} />
            ) : (
              <IconCircleFilled size={24} />
            )}
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
