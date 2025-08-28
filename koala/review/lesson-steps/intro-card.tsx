import { Stack, Text } from "@mantine/core";
import { CardReviewProps } from "../types";
import { useState } from "react";
import { useVoiceTranscription } from "../use-voice-transcription";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { usePhaseManager } from "../hooks/usePhaseManager";
import { useRecordingProcessor } from "../hooks/useRecordingProcessor";
import { CardImage } from "../components/CardImage";

type Phase = "ready" | "processing" | "retry" | "success";

interface IntroCardProps extends CardReviewProps {
  isRemedial?: boolean;
}

export const IntroCard: React.FC<IntroCardProps> = ({
  card,
  recordings,
  onProceed,
  currentStepUuid,
  isRemedial = false,
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

  const processRecording = async (base64Audio: string) => {
    setPhase("processing");

    try {
      const { transcription, isMatch } = await transcribe(base64Audio);
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

  useRecordingProcessor({
    recordings,
    currentStepUuid,
    onAudioReceived: processRecording,
  });

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
