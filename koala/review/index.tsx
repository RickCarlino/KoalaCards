import { Box } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHotkeys } from "@mantine/hooks";
import React from "react";
import { trpc } from "../trpc-config";
import { ControlBar } from "./control-bar";
import { HOTKEYS } from "./hotkeys";
import { NewWordIntro } from "./lesson-steps/new-word-intro";
import { NewWordOutro } from "./lesson-steps/new-word-outro";
import { RemedialIntro } from "./lesson-steps/remedial-intro";
import { RemedialOutro } from "./lesson-steps/remedial-outro";
import { Speaking } from "./lesson-steps/speaking";
import { CardReviewProps, CardUI, ItemType } from "./types";
import { Grade } from "femto-fsrs";

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
  completeItem: (uuid: string) => void;
  onPlayAudio: () => void;
  progress?: number;
  cardsRemaining?: number;
  onOpenAssistant?: () => void;
  disableRecord?: boolean;
  onFail?: () => void;
}

import { useRef } from "react";
import { useMediaRecorder } from "@/koala/hooks/use-media-recorder";
import { useUserSettings } from "@/koala/settings-provider";
import { playBlob } from "@/koala/utils/play-blob-audio";
import { playAudio } from "@/koala/play-audio";

export const CardReview: React.FC<CardReviewWithRecordingProps> = (
  props,
) => {
  const {
    card,
    completeItem,
    currentStepUuid,
    itemType,
    onPlayAudio,
    onSkip,
  } = props;

  const CardComponent = cardUIs[itemType] ?? UnknownCard;

  const onAudioHandlerRef = useRef<null | ((blob: Blob) => Promise<void>)>(
    null,
  );
  const { start, stop, isRecording } = useMediaRecorder();
  const userSettings = useUserSettings();

  // Show a helpful notification if mic access fails (with iOS Safari guidance)
  // Error handling moved into consumer callbacks as needed.

  const openCardEditor = () =>
    window.open(`/cards/${card.cardId}`, "_blank");

  const archiveCardMutation = trpc.archiveCard.useMutation();
  const gradeQuiz = trpc.gradeQuiz.useMutation({
    onSuccess: () => completeItem(currentStepUuid),
  });

  const handleArchive = async () => {
    try {
      await archiveCardMutation.mutateAsync({ cardID: card.cardId });
    } catch (error) {
      console.error("Failed to archive card:", error);
    } finally {
      onSkip(card.uuid);
    }
  };

  const handleRecordToggle = async () => {
    if (props.disableRecord) {
      return;
    }
    if (!isRecording) {
      await start().catch(() => {
        notifications.show({
          title: "Microphone error",
          message:
            "Microphone access failed. On iOS: enable Microphone for Safari or the PWA in Settings.",
          color: "red",
        });
      });
      return;
    }
    const blob = await stop();
    // Probabilistic self-playback of user's own recording (await to avoid overlap)
    if (userSettings && Math.random() < userSettings.playbackPercentage) {
      await playBlob(blob, userSettings.playbackSpeed);
    }
    if (onAudioHandlerRef.current) {
      void onAudioHandlerRef.current(blob).catch(() => undefined);
    }
  };

  const isQuizStep =
    itemType === "speaking" ||
    itemType === "newWordOutro" ||
    itemType === "remedialOutro";

  const handleFail = async () => {
    // Always reinforce by playing the term audio twice on fail
    await playAudio(
      card.termAndDefinitionAudio,
      userSettings.playbackSpeed,
    );
    await playAudio(
      card.termAndDefinitionAudio,
      userSettings.playbackSpeed,
    );
    if (isQuizStep) {
      // Proper "fail": grade AGAIN and advance
      await gradeQuiz.mutateAsync({
        perceivedDifficulty: Grade.AGAIN,
        cardID: card.cardId,
      });
      return;
    }
    // Non-quiz steps: advance to next (no extra audio; already played above)
    onSkip(card.uuid);
  };

  useHotkeys([
    [HOTKEYS.PLAY, onPlayAudio],
    [HOTKEYS.EDIT, openCardEditor],
    [HOTKEYS.SKIP, () => onSkip(card.uuid)],
    [HOTKEYS.ARCHIVE, handleArchive],
    [HOTKEYS.FAIL, handleFail],
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
        <CardComponent
          {...props}
          onProvideAudioHandler={(handler) => {
            onAudioHandlerRef.current = handler;
          }}
        />
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
          isRecording={isRecording}
          onRecordClick={handleRecordToggle}
          onArchiveClick={handleArchive}
          progress={props.progress}
          cardsRemaining={props.cardsRemaining}
          onOpenAssistant={props.onOpenAssistant}
          disableRecord={props.disableRecord}
          onFail={handleFail}
        />
      </Box>
    </Box>
  );
};
