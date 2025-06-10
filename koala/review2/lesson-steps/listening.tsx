import { playAudio } from "@/koala/play-audio";
import { Stack, Text, Image } from "@mantine/core";
import { CardUI } from "../types";
import { useEffect, useState } from "react";
import { useVoiceTranscription } from "../use-voice-transcription";
import { useQuizGrading } from "../use-quiz-grading";
import { VisualDiff } from "@/koala/review/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { GradingSuccess } from "../components/GradingSuccess";
import { Grade } from "femto-fsrs";

type Phase = "ready" | "processing" | "retry" | "success";

export const Listening: CardUI = ({
  card,
  recordings,
  onProceed,
  currentStepUuid,
}) => {
  const { term, definition } = card;
  const [phase, setPhase] = useState<Phase>("ready");
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

  useEffect(() => {
    if (card.termAudio) {
      playAudio(card.termAudio);
    }
  }, [card.termAudio]);

  // Reset phase when step changes
  useEffect(() => {
    setPhase("ready");
    setUserTranscription("");
  }, [currentStepUuid]);

  const processRecording = async (base64Audio: string) => {
    setPhase("processing");

    try {
      const { transcription, isMatch } = await transcribe(base64Audio);
      setUserTranscription(transcription);

      if (isMatch) {
        // Success - play definition audio, show term/definition, then show grading
        setPhase("success");
        if (card.definitionAudio) {
          await playAudio(card.definitionAudio);
        }
      } else {
        // Failed - show retry state and replay term
        setPhase("retry");
        await playAudio(card.termAudio);
      }
    } catch (error) {
      console.error("Transcription error:", error);
      setPhase("retry");
      setUserTranscription("Error occurred during transcription.");
    }
  };

  // Listen for recordings from TopBar
  useEffect(() => {
    const currentRecording = recordings?.[currentStepUuid];
    if (currentRecording?.audio) {
      processRecording(currentRecording.audio);
    }
  }, [recordings?.[currentStepUuid]?.audio]);

  const handleGradeSelect = async (grade: Grade) => {
    switch (grade) {
      case Grade.AGAIN:
        await gradeWithAgain();
        break;
      case Grade.HARD:
        await gradeWithHard();
        break;
      case Grade.GOOD:
        await gradeWithGood();
        break;
      case Grade.EASY:
        await gradeWithEasy();
        break;
    }
  };

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
      {card.imageURL && (
        <Image
          src={card.imageURL}
          alt={`Image: ${term}`}
          maw="100%"
          mah={240}
          fit="contain"
        />
      )}

      <Text ta="center" c="blue" fw={500} size="sm">
        Listening Quiz
      </Text>

      {renderContent()}
    </Stack>
  );
};
