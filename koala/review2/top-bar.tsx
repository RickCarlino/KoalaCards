import { ActionIcon, Group, Progress, Tooltip } from "@mantine/core";
import {
  IconArchive,
  IconEdit,
  IconMicrophone,
  IconPlayerPlayFilled,
  IconPlayerSkipForwardFilled,
  IconPlayerStopFilled,
  IconX,
} from "@tabler/icons-react";
import React from "react";
import { playAudio } from "../play-audio";
import { blobToBase64, convertBlobToWav } from "../record-button";
import { useVoiceRecorder } from "../use-recorder";
import { CardReviewProps } from "./types";

interface TopBarProps extends CardReviewProps {
  onRecordingComplete?: (base64: string) => void;
  currentStepUuid: string;
}

export const TopBar: React.FC<TopBarProps> = (props) => {
  const { card, itemsComplete, totalItems, onSkip, onGiveUp } = props;
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);
  const progress = totalItems ? (itemsComplete / totalItems) * 100 : 0;

  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

  const handlePlayAudio = () => {
    if (card.termAudio) {
      playAudio(card.termAudio);
    }
  };

  async function handleRecordingResult(blob: Blob) {
    if (props.onRecordingComplete) {
      const wav = await convertBlobToWav(blob);
      const base64 = await blobToBase64(wav);
      props.onRecordingComplete(base64);
    }
  }

  const handleRecordClick = () => {
    if (voiceRecorder.isRecording) {
      voiceRecorder.stop();
    } else {
      voiceRecorder.start();
    }
  };

  return (
    <>
      <Group justify="center" wrap="wrap" gap="xs">
        <Tooltip
          label={
            voiceRecorder.isRecording
              ? "Stop recording"
              : "Start recording"
          }
        >
          <ActionIcon
            variant={voiceRecorder.isRecording ? "filled" : "outline"}
            size="lg"
            onClick={handleRecordClick}
          >
            {voiceRecorder.isRecording ? (
              <IconPlayerStopFilled size={20} />
            ) : (
              <IconMicrophone size={20} />
            )}
          </ActionIcon>
        </Tooltip>

        {card.termAudio && (
          <Tooltip label="Play audio">
            <ActionIcon
              variant="outline"
              size="lg"
              onClick={handlePlayAudio}
            >
              <IconPlayerPlayFilled size={20} />
            </ActionIcon>
          </Tooltip>
        )}

        <Tooltip label="Skip card">
          <ActionIcon
            variant="outline"
            size="lg"
            onClick={() => onSkip(card.uuid)}
          >
            <IconPlayerSkipForwardFilled size={20} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Edit card">
          <ActionIcon variant="outline" size="lg" onClick={openCardEditor}>
            <IconEdit size={20} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Archive card">
          <ActionIcon
            variant="outline"
            size="lg"
            onClick={() => console.log("Archive card:", card.uuid)}
          >
            <IconArchive size={20} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Give up on card">
          <ActionIcon
            variant="outline"
            size="lg"
            onClick={() => onGiveUp(card.uuid)}
          >
            <IconX size={20} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Progress
        value={progress}
        size="lg"
        radius="xs"
        color="teal"
        mt="xs"
      />
    </>
  );
};
