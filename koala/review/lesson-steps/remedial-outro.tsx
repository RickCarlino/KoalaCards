import { Stack, Text, Image, Button } from "@mantine/core";
import { CardUI, GradingResult } from "../types";
import { useState } from "react";
import { useVoiceGrading } from "../use-voice-grading";
import { LangCode } from "@/koala/shared-types";
import { FailureView } from "../components/FailureView";
import { CardImage } from "../components/CardImage";
import { usePhaseManager } from "../hooks/usePhaseManager";
import { useRecordingProcessor } from "../hooks/useRecordingProcessor";
import { HOTKEYS } from "../hotkeys";

type Phase = "ready" | "processing" | "success" | "failure";

const SuccessView = ({
  imageURL,
  term,
  definition,
  onContinue,
  successText,
}: {
  imageURL?: string;
  term: string;
  definition: string;
  onContinue: () => void;
  successText?: string;
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

      <Text ta="center" c="green" fw={500} size="lg">
        {successText || "Well done!"}
      </Text>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>

      <Button onClick={onContinue} variant="light" color="green">
        Continue ({HOTKEYS.CONTINUE})
      </Button>
    </Stack>
  );
};

export const RemedialOutro: CardUI = ({
  card,
  recordings,
  onProceed,
  currentStepUuid,
  onGradingResultCaptured,
}) => {
  const { term, definition } = card;
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(
    null,
  );

  const { gradeAudio } = useVoiceGrading({
    targetText: card.term,
    langCode: card.langCode as LangCode,
    quizId: card.quizId,
    cardUUID: card.uuid,
    onGradingResultCaptured,
  });

  const { phase, setPhase } = usePhaseManager<Phase>(
    "ready",
    currentStepUuid,
    () => setGradingResult(null),
  );

  const processRecording = async (base64Audio: string) => {
    setPhase("processing");

    try {
      const result = await gradeAudio(base64Audio);
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
      });
    }
  };

  useRecordingProcessor({
    recordings,
    currentStepUuid,
    onAudioReceived: processRecording,
  });

  // Early return for failure case
  if (phase === "failure") {
    return (
      <FailureView
        imageURL={card.imageURL}
        term={term}
        definition={definition}
        userTranscription={gradingResult?.transcription || ""}
        onContinue={onProceed}
        failureText={gradingResult?.feedback || "Not quite right"}
        termAudio={card.termAudio}
        autoPlayAudio={true}
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
      <CardImage imageURL={card.imageURL} term={term} />

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
