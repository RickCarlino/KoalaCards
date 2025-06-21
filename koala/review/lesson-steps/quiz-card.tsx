import { Stack, Text } from "@mantine/core";
import { CardReviewProps } from "../types";
import { useState } from "react";
import { useVoiceGrading } from "../use-voice-grading";
import { useQuizGrading } from "../use-quiz-grading";
import { LangCode } from "@/koala/shared-types";
import { GradingSuccess } from "../components/GradingSuccess";
import { FailureView } from "../components/FailureView";
import { CardImage } from "../components/CardImage";
import { usePhaseManager } from "../hooks/usePhaseManager";
import { useRecordingProcessor } from "../hooks/useRecordingProcessor";
import { useGradeHandler } from "../hooks/useGradeHandler";

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
        promptText: (definition: string) =>
          `Say "${definition}" in the target language`,
        instructionText:
          "Press the record button above and say the phrase in the target language.",
        failureText: "Not quite right",
      };
    case "newWordOutro":
      return {
        headerText: null,
        headerColor: null,
        promptText: (definition: string) =>
          `How would you say "${definition}"?`,
        instructionText:
          "Press the record button above and say the phrase in the target language.",
        failureText: "You got it wrong",
      };
    case "remedialOutro":
      return {
        headerText: "Remedial Review",
        headerColor: "orange" as const,
        promptText: (definition: string) =>
          `How would you say "${definition}"?`,
        instructionText:
          "Press the record button above and say the phrase in the target language.",
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
  onGradingResultCaptured,
}) => {
  const { term, definition } = card;
  const [userTranscription, setUserTranscription] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");

  const config = getQuizConfig(quizType);

  const { gradeAudio } = useVoiceGrading({
    targetText: card.term,
    langCode: card.langCode as LangCode,
    quizId: card.quizId,
    cardUUID: card.uuid,
    onGradingResultCaptured,
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
    () => {
      setUserTranscription("");
      setFeedback("");
    },
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

  useRecordingProcessor({
    recordings,
    currentStepUuid,
    onAudioReceived: processRecording,
  });

  const handleFailureContinue = async () => {
    // Grade the quiz as AGAIN (failed) and proceed
    await gradeWithAgain();
    onProceed();
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
        termAudio={card.termAudio}
        autoPlayAudio={true}
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
      <CardImage imageURL={card.imageURL} term={term} />

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
