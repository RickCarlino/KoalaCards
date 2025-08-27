import { Box } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHotkeys } from "@mantine/hooks";
import React from "react";
import { blobToBase64 } from "../record-button";
import { trpc } from "../trpc-config";
import { useVoiceRecorder } from "../use-recorder";
import { ControlBar } from "./control-bar";
import { HOTKEYS } from "./hotkeys";
import { NewWordIntro } from "./lesson-steps/new-word-intro";
import { NewWordOutro } from "./lesson-steps/new-word-outro";
import { RemedialIntro } from "./lesson-steps/remedial-intro";
import { RemedialOutro } from "./lesson-steps/remedial-outro";
import { Speaking } from "./lesson-steps/speaking";
import { CardReviewProps, CardUI, ItemType } from "./types";

const cardUIs: Record<ItemType, CardUI> = {
  newWordIntro: NewWordIntro,
  newWordOutro: NewWordOutro,
  speaking: Speaking,
  remedialIntro: RemedialIntro,
  remedialOutro: RemedialOutro,
};

const UnknownCard: CardUI = ({ card }) => (
  <div>{`UNKNOWN CARD TYPE: ${card.uuid}`}</div>
);

interface CardReviewWithRecordingProps extends CardReviewProps {
  currentStepUuid: string;
  onRecordingComplete: (audio: string) => void;
  completeItem: (uuid: string) => void;
  onPlayAudio: () => void;
  progress?: number;
  cardsRemaining?: number;
  onOpenAssistant?: () => void;
  disableRecord?: boolean;
}

export const CardReview: React.FC<CardReviewWithRecordingProps> = (
  props,
) => {
  const {
    card,
    completeItem,
    currentStepUuid,
    itemType,
    onGiveUp,
    onPlayAudio,
    onRecordingComplete,
    onSkip,
  } = props;

  const CardComponent = cardUIs[itemType] ?? UnknownCard;

  async function handleRecordingResult(blob: Blob) {
    // Send the recorded blob as-is with the correct MIME header.
    // Server supports mp4/m4a, webm, wav and others.
    const base64 = await blobToBase64(blob);
    onRecordingComplete(base64);
  }

  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  // Show a helpful notification if mic access fails (with iOS Safari guidance)
  React.useEffect(() => {
    if (voiceRecorder.error) {
      const message =
        "Microphone access failed. On iOS: Settings > Safari > Microphone > Allow. If added to Home Screen, enable Microphone under Settings > Koala Cards.";
      notifications.show({
        title: "Microphone error",
        message,
        color: "red",
      });
    }
  }, [voiceRecorder.error]);

  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

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
    if (props.disableRecord) {
      return;
    }
    if (voiceRecorder.isRecording) {
      voiceRecorder.stop();
    } else {
      voiceRecorder.start();
    }
  };

  useHotkeys([
    [HOTKEYS.PLAY, onPlayAudio],
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
          padding:
            "calc(var(--mantine-spacing-sm) + env(safe-area-inset-bottom) / 2) var(--mantine-spacing-sm)",
          zIndex: 100,
        }}
      >
        <ControlBar
          {...props}
          currentStepUuid={currentStepUuid}
          isRecording={voiceRecorder.isRecording}
          onRecordClick={handleRecordToggle}
          onArchiveClick={handleArchive}
          progress={props.progress}
          cardsRemaining={props.cardsRemaining}
          onOpenAssistant={props.onOpenAssistant}
          disableRecord={props.disableRecord}
        />
      </Box>
    </Box>
  );
};
