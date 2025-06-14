import { Box } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import React from "react";
import { playAudio } from "../play-audio";
import { blobToBase64, convertBlobToWav } from "../record-button";
import { trpc } from "../trpc-config";
import { useVoiceRecorder } from "../use-recorder";
import { ControlBar } from "./control-bar";
import { HOTKEYS } from "./hotkeys";
import { Feedback } from "./lesson-steps/feedback";
import { Listening } from "./lesson-steps/listening";
import { NewWordIntro } from "./lesson-steps/new-word-intro";
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

interface CardReviewWithRecordingProps extends CardReviewProps {
  currentStepUuid: string;
  onRecordingComplete: (audio: string) => void;
  completeItem: (uuid: string) => void;
}

export const CardReview: React.FC<CardReviewWithRecordingProps> = (
  props,
) => {
  const {
    itemType,
    currentStepUuid,
    onRecordingComplete,
    card,
    onSkip,
    onGiveUp,
    completeItem,
  } = props;

  const CardComponent = cardUIs[itemType] ?? UnknownCard;

  async function handleRecordingResult(blob: Blob) {
    const wav = await convertBlobToWav(blob);
    const base64 = await blobToBase64(wav);
    onRecordingComplete(base64);
  }

  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

  const handlePlayAudio = () => {
    if (card.termAudio) {
      playAudio(card.termAudio);
    }
  };

  const archiveCardMutation = trpc.archiveCard.useMutation();

  const handleArchive = async () => {
    try {
      await archiveCardMutation.mutateAsync({ cardID: card.cardId });
    } catch (error) {
      console.error("Failed to archive card:", error);
    } finally {
      onSkip(card.uuid);
    }
  };

  const handleRecordToggle = () => {
    if (voiceRecorder.isRecording) {
      voiceRecorder.stop();
    } else {
      voiceRecorder.start();
    }
  };

  useHotkeys([
    [HOTKEYS.PLAY, handlePlayAudio],
    [HOTKEYS.EDIT, openCardEditor],
    [HOTKEYS.SKIP, () => onSkip(card.uuid)],
    [HOTKEYS.ARCHIVE, handleArchive],
    [HOTKEYS.FAIL, () => onGiveUp(card.uuid)],
    [HOTKEYS.RECORD, handleRecordToggle],
    [HOTKEYS.CONTINUE, () => completeItem(currentStepUuid)],
  ] as [string, () => void][]);

  return (
    <Box
      style={{
        minHeight: "100vh",
        position: "relative",
        paddingBottom: "80px",
      }}
    >
      <Box p="md">
        <CardComponent {...props} />
      </Box>
      <Box
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "var(--mantine-color-pink-0)",
          borderTop: "1px solid var(--mantine-color-pink-2)",
          padding: "var(--mantine-spacing-sm)",
          zIndex: 100,
        }}
      >
        <ControlBar
          {...props}
          currentStepUuid={currentStepUuid}
          isRecording={voiceRecorder.isRecording}
          onRecordClick={handleRecordToggle}
        />
      </Box>
    </Box>
  );
};
