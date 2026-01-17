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
import { useQuizGrading } from "../use-quiz-grading";
import { useUserSettings } from "@/koala/settings-provider";
import { playSpeechText, playTermThenDefinition } from "../playback";

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

      {renderSuccessSection(successText, quizResultId, onContinue)}

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

function renderSuccessSection(
  successText?: string,
  quizResultId?: number | null,
  onContinue?: () => void,
) {
  if (successText) {
    return (
      <Stack gap={4} align="center">
        <Text ta="center" c="green" fw={500} size="lg">
          {successText}
        </Text>
        {quizResultId && (
          <FeedbackVote resultId={quizResultId} onClick={onContinue} />
        )}
      </Stack>
    );
  }
  return (
    <Text ta="center" c="green" fw={500} size="lg">
      Well done!
    </Text>
  );
}

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
  const userSettings = useUserSettings();
  const { gradeWithAgain, isLoading } = useQuizGrading({
    cardId: card.cardId,
    onSuccess: onProceed,
  });

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

  useEffect(() => {
    onProvideAudioHandler?.(processRecording);
  }, [currentStepUuid]);

  const feedbackText = gradingResult?.feedback?.trim() ?? "";

  useEffect(() => {
    if (phase !== "failure" || !feedbackText) {
      return;
    }
    void playSpeechText(feedbackText, userSettings.playbackSpeed).catch(
      (error) => {
        console.error("Failed to play correction audio:", error);
      },
    );
  }, [feedbackText, phase, userSettings.playbackSpeed]);

  const handleIDK = async () => {
    await playTermThenDefinition(card, userSettings.playbackSpeed);
    await playTermThenDefinition(card, userSettings.playbackSpeed);
    await gradeWithAgain();
  };

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

      <Button
        color="red"
        variant="outline"
        onClick={handleIDK}
        disabled={isLoading}
        fullWidth
        size="md"
        maw={400}
      >
        I don't know ({HOTKEYS.FAIL})
      </Button>

      {renderContent()}
    </Stack>
  );
};
