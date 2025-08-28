import { Stack, Text } from "@mantine/core";
import { CardReviewProps } from "../types";
import { useEffect, useState } from "react";
import { useVoiceTranscription } from "../use-voice-transcription";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { usePhaseManager } from "../hooks/usePhaseManager";
import { CardImage } from "../components/CardImage";

type Phase = "ready" | "processing" | "retry" | "success";

interface IntroCardProps extends CardReviewProps {
  isRemedial?: boolean;
}

export const IntroCard: React.FC<IntroCardProps> = ({
  card,
  onProceed,
  currentStepUuid,
  isRemedial = false,
  onProvideAudioHandler,
}) => {
  const { term, definition } = card;
  const [userTranscription, setUserTranscription] = useState<string>("");

  const { transcribe } = useVoiceTranscription({
    targetText: card.term,
    langCode: card.langCode as LangCode,
  });

  const { phase, setPhase } = usePhaseManager<Phase>(
    "ready",
    currentStepUuid,
    () => setUserTranscription(""),
  );

  const processRecording = async (blob: Blob) => {
    setPhase("processing");

    try {
      const { transcription, isMatch } = await transcribe(blob);
      setUserTranscription(transcription);

      if (isMatch) {
        setPhase("success");
        onProceed();
      } else {
        setPhase("retry");
      }
    } catch (error) {
      setPhase("retry");
      setUserTranscription("Error occurred during transcription.");
    }
  };

  // Register handler for parent to trigger when recording stops
  useEffect(() => {
    onProvideAudioHandler?.(processRecording);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepUuid]);

  const renderContent = () => {
    switch (phase) {
      case "ready":
        return (
          <Text ta="center" c="dimmed">
            Press the record button above and repeat the phrase.
          </Text>
        );

      case "processing":
        return (
          <Text ta="center" c="dimmed">
            Processing your recording...
          </Text>
        );

      case "retry":
        return (
          <>
            <VisualDiff expected={term} actual={userTranscription} />
            <Text ta="center" c="dimmed">
              Try again - press record and repeat the phrase
            </Text>
          </>
        );

      case "success":
        return (
          <Text ta="center" c="green" fw={500}>
            Correct!
          </Text>
        );

      default:
        return null;
    }
  };

  return (
    <Stack align="center" gap="md">
      <CardImage imageURL={card.imageURL} definition={definition} />

      <Text
        ta="center"
        c={isRemedial ? "orange" : "green"}
        fw={500}
        size="sm"
      >
        {isRemedial ? "Re-Learn a Card" : "New Card"}
      </Text>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>

      {renderContent()}
    </Stack>
  );
};
