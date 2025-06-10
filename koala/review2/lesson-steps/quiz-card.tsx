import { Stack, Text, Image } from "@mantine/core";
import { CardReviewProps } from "../types";
import { useEffect, useState } from "react";
import { useVoiceGrading } from "../use-voice-grading";
import { useQuizGrading } from "../use-quiz-grading";
import { LangCode } from "@/koala/shared-types";
import { GradingSuccess } from "../components/GradingSuccess";
import { FailureView } from "../components/FailureView";
import { Grade } from "femto-fsrs";

type Phase = "ready" | "processing" | "success" | "failure";
type QuizType = "speaking" | "newWordOutro" | "remedialOutro";

interface QuizCardProps extends CardReviewProps {
  quizType: QuizType;
}

const getQuizConfig = (quizType: QuizType) => {
  switch (quizType) {
    case "speaking":
      return {
        headerText: "Speaking Quiz",
        headerColor: "blue" as const,
        promptText: (definition: string) => `Say "${definition}" in the target language`,
        instructionText: "Press the record button above and say the phrase in the target language.",
        failureText: "Not quite right",
      };
    case "newWordOutro":
      return {
        headerText: null,
        headerColor: null,
        promptText: (definition: string) => `How would you say "${definition}"?`,
        instructionText: "Press the record button above and say the phrase in the target language.",
        failureText: "You got it wrong",
      };
    case "remedialOutro":
      return {
        headerText: "Remedial Review",
        headerColor: "orange" as const,
        promptText: (definition: string) => `How would you say "${definition}"?`,
        instructionText: "Press the record button above and say the phrase in the target language.",
        failureText: "Not quite right",
      };
  }
};

export const QuizCard: React.FC<QuizCardProps> = ({
  card,
  recordings,
  onProceed,
  currentStepUuid,
  quizType,
}) => {
  const { term, definition } = card;
  const [phase, setPhase] = useState<Phase>("ready");
  const [userTranscription, setUserTranscription] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");

  const config = getQuizConfig(quizType);

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
    // Grade the quiz as AGAIN (failed) and proceed
    await gradeWithAgain();
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
        failureText={config.failureText}
      />
    );
  }

  const renderContent = () => {
    switch (phase) {
      case "ready":
        return (
          <Text ta="center" c="dimmed">
            {config.instructionText}
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

      {config.headerText && (
        <Text ta="center" c={config.headerColor} fw={500} size="sm">
          {config.headerText}
        </Text>
      )}

      <Text size="xl" fw={700} ta="center">
        {config.promptText(definition)}
      </Text>

      {renderContent()}
    </Stack>
  );
};