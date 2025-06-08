import { Stack, Text, Image, Button } from "@mantine/core";
import { CardUI } from "../types";
import { useEffect, useState } from "react";
import { useVoiceGrading } from "../use-voice-grading";
import { useQuizGrading } from "../use-quiz-grading";
import { LangCode } from "@/koala/shared-types";
import { GradingSuccess } from "../components/GradingSuccess";
import { Grade } from "femto-fsrs";

type Phase = "ready" | "processing" | "success" | "failure";

const FailureView = ({
  imageURL,
  term,
  definition,
  userTranscription,
  feedback,
  onContinue,
}: {
  imageURL?: string;
  term: string;
  definition: string;
  userTranscription: string;
  feedback: string;
  onContinue: () => void;
}) => {
  return (
    <Stack align="center" gap="md">
      {imageURL && (
        <Image
          src={imageURL}
          alt={`Image: ${term}`}
          maw="100%"
          mah={240}
          fit="contain"
        />
      )}

      <Text ta="center" c="red" fw={500} size="lg">
        You got it wrong
      </Text>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>

      <Text ta="center" size="sm" c="dimmed">
        You said: "{userTranscription}"
      </Text>

      <Text ta="center" c="dimmed">
        {feedback || "Try again next time!"}
      </Text>

      <Button onClick={onContinue} variant="light" color="blue">
        Continue
      </Button>
    </Stack>
  );
};

export const NewWordOutro: CardUI = ({
  card,
  recordings,
  onProceed,
  currentStepUuid,
}) => {
  const { term, definition } = card;
  const [phase, setPhase] = useState<Phase>("ready");
  const [userTranscription, setUserTranscription] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");

  const { gradeAudio } = useVoiceGrading({
    targetText: card.term,
    langCode: card.langCode as LangCode,
    quizId: card.quizId,
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

  // Reset phase when step changes
  useEffect(() => {
    setPhase("ready");
    setUserTranscription("");
    setFeedback("");
  }, [currentStepUuid]);

  const processRecording = async (base64Audio: string) => {
    setPhase("processing");

    try {
      const result = await gradeAudio(base64Audio);
      setUserTranscription(result.transcription);
      setFeedback(result.feedback);

      if (result.isCorrect) {
        setPhase("success");
      } else {
        setPhase("failure");
      }
    } catch (error) {
      console.error("Grading error:", error);
      setPhase("failure");
      setFeedback("Error occurred during grading.");
    }
  };

  // Listen for recordings from TopBar
  useEffect(() => {
    const currentRecording = recordings?.[currentStepUuid];
    if (currentRecording?.audio) {
      processRecording(currentRecording.audio);
    }
  }, [recordings?.[currentStepUuid]?.audio]);

  const handleFailureContinue = async () => {
    // Grade the quiz as AGAIN (failed)
    await gradeWithAgain();
    // Then proceed to the next item
    onProceed();
  };

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

  // Early return for failure case
  if (phase === "failure") {
    return (
      <FailureView
        imageURL={card.imageURL}
        term={term}
        definition={definition}
        userTranscription={userTranscription}
        feedback={feedback}
        onContinue={handleFailureContinue}
      />
    );
  }

  const renderContent = () => {
    switch (phase) {
      case "ready":
        return (
          <Text ta="center" c="dimmed">
            Press the record button above and say the phrase in the target
            language.
          </Text>
        );

      case "processing":
        return (
          <Text ta="center" c="dimmed">
            Grading your response...
          </Text>
        );

      case "success":
        return (
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

      <Text size="xl" fw={700} ta="center">
        How would you say "{definition}"?
      </Text>

      {renderContent()}
    </Stack>
  );
};
