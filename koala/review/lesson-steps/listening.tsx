import { Stack, Text } from "@mantine/core";
import { CardUI } from "../types";
import { useEffect, useState } from "react";
import { useVoiceTranscription } from "../use-voice-transcription";
import { useQuizGrading } from "../use-quiz-grading";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { GradingSuccess } from "../components/GradingSuccess";
import { CardImage } from "../components/CardImage";
import { usePhaseManager } from "../hooks/usePhaseManager";
import { useRecordingProcessor } from "../hooks/useRecordingProcessor";
import { useGradeHandler } from "../hooks/useGradeHandler";
import { playAudio } from "@/koala/play-audio";

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
      } else {
        // Failed - show retry state and replay term
        setPhase("retry");
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
  const play = async () => {
    // await playAudio(card.termAudio);
    await playAudio(card.definitionAudio);
  };

  useEffect(() => {
    if (phase === "success") {
      play();
    }
  }, [phase]);

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
      <CardImage imageURL={card.imageURL} definition={definition} />

      <Text ta="center" c="blue" fw={500} size="sm">
        Phrase Recognition Quiz
      </Text>

      {renderContent()}
    </Stack>
  );
};
