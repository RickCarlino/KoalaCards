import { Stack, Text, Image, Button } from "@mantine/core";
import { CardUI, GradingResult } from "../types";
import { useEffect, useState } from "react";
import { useVoiceGrading } from "../use-voice-grading";
import { LangCode } from "@/koala/shared-types";
import { FailureView } from "../components/FailureView";
import { CardImage } from "../components/CardImage";
import { usePhaseManager } from "../hooks/usePhaseManager";
import { HOTKEYS } from "../hotkeys";
import { FeedbackVote } from "../components/FeedbackVote";

type Phase = "ready" | "processing" | "success" | "failure";

const SuccessView = ({
  imageURL,
  term,
  definition,
  onContinue,
  successText,
  quizResultId,
}: {
  imageURL?: string;
  term: string;
  definition: string;
  onContinue: () => void;
  successText?: string;
  quizResultId?: number | null;
}) => {
  let successSection: React.ReactNode;
  if (successText) {
    successSection = (
      <Stack gap={4} align="center">
        <Text ta="center" c="green" fw={500} size="lg">
          {successText}
        </Text>
        {quizResultId && <FeedbackVote resultId={quizResultId} />}
      </Stack>
    );
  } else {
    successSection = (
      <Text ta="center" c="green" fw={500} size="lg">
        Well done!
      </Text>
    );
  }
  return (
    <Stack align="center" gap="md">
      {imageURL && (
        <Image
          src={imageURL}
          alt={`Image: ${definition}`}
          maw="100%"
          mah={240}
          fit="contain"
        />
      )}

      {successSection}

      <Button onClick={onContinue} variant="light" color="green">
        Continue ({HOTKEYS.CONTINUE})
      </Button>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>
    </Stack>
  );
};

export const RemedialOutro: CardUI = ({
  card,
  onProceed,
  currentStepUuid,
  onGradingResultCaptured,
  onProvideAudioHandler,
}) => {
  const { term, definition } = card;
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(
    null,
  );

  const { gradeAudio } = useVoiceGrading({
    targetText: card.term,
    langCode: card.langCode as LangCode,
    cardId: card.cardId,
    cardUUID: card.uuid,
    onGradingResultCaptured,
  });

  const { phase, setPhase } = usePhaseManager<Phase>(
    "ready",
    currentStepUuid,
    () => setGradingResult(null),
  );

  const processRecording = async (blob: Blob) => {
    setPhase("processing");

    try {
      const result = await gradeAudio(blob);
      setGradingResult(result);

      if (result.isCorrect) {
        setPhase("success");
      } else {
        setPhase("failure");
      }
    } catch (error) {
      console.error("Grading error:", error);
      setPhase("failure");
      setGradingResult({
        transcription: "Error occurred during processing.",
        isCorrect: false,
        feedback: "An error occurred while processing your response.",
        quizResultId: null,
      });
    }
  };

  // Register handler for parent to trigger on recording stop
  useEffect(() => {
    onProvideAudioHandler?.(processRecording);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepUuid]);

  // Early return for failure case
  if (phase === "failure") {
    return (
      <FailureView
        imageURL={card.imageURL}
        term={term}
        definition={definition}
        userTranscription={gradingResult?.transcription || ""}
        quizResultId={gradingResult?.quizResultId ?? null}
        onContinue={onProceed}
        failureText={gradingResult?.feedback || "Not quite right"}
      />
    );
  }

  // Early return for success case
  if (phase === "success") {
    return (
      <SuccessView
        imageURL={card.imageURL}
        term={term}
        definition={definition}
        onContinue={onProceed}
        successText={gradingResult?.feedback || ""}
        quizResultId={gradingResult?.quizResultId ?? null}
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
            Processing your response...
          </Text>
        );

      default:
        return null;
    }
  };

  return (
    <Stack align="center" gap="md">
      <CardImage imageURL={card.imageURL} definition={definition} />

      <Text ta="center" c="orange" fw={500} size="sm">
        Remedial Review
      </Text>

      <Text size="xl" fw={700} ta="center">
        How would you say "{definition}"?
      </Text>

      {renderContent()}
    </Stack>
  );
};
