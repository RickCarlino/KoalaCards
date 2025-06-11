import { Stack, Text } from "@mantine/core";
import { CardReviewProps } from "../types";
import { useState } from "react";
import { useVoiceTranscription } from "../use-voice-transcription";
import { VisualDiff } from "@/koala/review/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { usePhaseManager } from "../hooks/usePhaseManager";
import { useRecordingProcessor } from "../hooks/useRecordingProcessor";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
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

  const { playSuccessSequence } = useAudioPlayback({
    termAudio: card.termAudio,
    autoPlay: true,
  });

  const processRecording = async (base64Audio: string) => {
    setPhase("processing");

    try {
      const { transcription, isMatch } = await transcribe(base64Audio);
      setUserTranscription(transcription);

      if (isMatch) {
        // Success - show success state, play audio, then proceed
        setPhase("success");
        await playSuccessSequence(card.definitionAudio);
        onProceed();
      } else {
        // Failed - show retry state and replay term
        setPhase("retry");
        await playSuccessSequence(); // Just plays term audio
      }
    } catch (error) {
      console.error("Transcription error:", error);
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
      <CardImage imageURL={card.imageURL} term={term} />

      <Text
        ta="center"
        c={isRemedial ? "orange" : "green"}
        fw={500}
        size="sm"
      >
        {isRemedial ? "Difficult Card" : "New Card"}
      </Text>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>

      {renderContent()}
    </Stack>
  );
};
