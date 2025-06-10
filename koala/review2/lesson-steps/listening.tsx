import { Stack, Text } from "@mantine/core";
import { CardUI } from "../types";
import { useState } from "react";
import { useVoiceTranscription } from "../use-voice-transcription";
import { useQuizGrading } from "../use-quiz-grading";
import { VisualDiff } from "@/koala/review/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { GradingSuccess } from "../components/GradingSuccess";
import { CardImage } from "../components/CardImage";
import { usePhaseManager } from "../hooks/usePhaseManager";
import { useRecordingProcessor } from "../hooks/useRecordingProcessor";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { useGradeHandler } from "../hooks/useGradeHandler";

type Phase = "ready" | "processing" | "retry" | "success";

export const Listening: CardUI = ({
  card,
  recordings,
  onProceed,
  currentStepUuid,
}) => {
  const { term, definition } = card;
  const [userTranscription, setUserTranscription] = useState<string>("");

  const { transcribe } = useVoiceTranscription({
    targetText: card.term,
    langCode: card.langCode as LangCode,
  });

  const {
    gradeWithAgain,
    gradeWithHard,
    gradeWithGood,
    gradeWithEasy,
    isLoading,
  } = useQuizGrading({
    quizId: card.quizId,
    onSuccess: onProceed,
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

  const { handleGradeSelect } = useGradeHandler({
    gradeWithAgain,
    gradeWithHard,
    gradeWithGood,
    gradeWithEasy,
  });

  const processRecording = async (base64Audio: string) => {
    setPhase("processing");

    try {
      const { transcription, isMatch } = await transcribe(base64Audio);
      setUserTranscription(transcription);

      if (isMatch) {
        // Success - play definition audio, show term/definition, then show grading
        setPhase("success");
        await playSuccessSequence(card.definitionAudio);
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
          <>
            <Text ta="center" c="dimmed">
              Press the record button and repeat what you heard.
            </Text>
            <Text ta="center" c="dimmed">
              As you repeat the phrase, can you remember the definition?
            </Text>
          </>
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
          <>
            <Text size="xl" fw={700} ta="center">
              {term}
            </Text>

            <Text ta="center">{definition}</Text>

            <GradingSuccess
              quizData={{
                difficulty: card.difficulty,
                stability: card.stability,
                lastReview: card.lastReview
                  ? typeof card.lastReview === "number"
                    ? card.lastReview
                    : new Date(card.lastReview).getTime()
                  : 0,
                lapses: card.lapses,
                repetitions: card.repetitions,
              }}
              onGradeSelect={handleGradeSelect}
              isLoading={isLoading}
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Stack align="center" gap="md">
      <CardImage imageURL={card.imageURL} term={term} />

      <Text ta="center" c="blue" fw={500} size="sm">
        Listening Quiz
      </Text>

      {renderContent()}
    </Stack>
  );
};
