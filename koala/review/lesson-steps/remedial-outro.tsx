import { Stack, Text, Image, Button } from "@mantine/core";
import { CardUI } from "../types";
import { useState } from "react";
import { useRepair } from "../use-repair";
import { LangCode } from "@/koala/shared-types";
import { FailureView } from "../components/FailureView";
import { CardImage } from "../components/CardImage";
import { usePhaseManager } from "../hooks/usePhaseManager";
import { useRecordingProcessor } from "../hooks/useRecordingProcessor";

type Phase = "ready" | "processing" | "success" | "failure";

const SuccessView = ({
  imageURL,
  term,
  definition,
  onContinue,
}: {
  imageURL?: string;
  term: string;
  definition: string;
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

      <Text ta="center" c="green" fw={500} size="lg">
        Well done!
      </Text>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>

      <Button onClick={onContinue} variant="light" color="green">
        Continue
      </Button>
    </Stack>
  );
};

export const RemedialOutro: CardUI = ({
  card,
  recordings,
  onProceed,
  currentStepUuid,
}) => {
  const { term, definition } = card;
  const [userTranscription, setUserTranscription] = useState<string>("");

  const { processAudio } = useRepair({
    cardId: card.cardId,
    targetText: card.term,
    langCode: card.langCode as LangCode,
  });

  const { phase, setPhase } = usePhaseManager<Phase>(
    "ready",
    currentStepUuid,
    () => setUserTranscription(""),
  );

  const processRecording = async (base64Audio: string) => {
    setPhase("processing");

    try {
      const result = await processAudio(base64Audio);
      setUserTranscription(result.transcription);

      if (result.isMatch) {
        setPhase("success");
      } else {
        setPhase("failure");
      }
    } catch (error) {
      console.error("Repair error:", error);
      setPhase("failure");
      setUserTranscription("Error occurred during processing.");
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
        userTranscription={userTranscription}
        onContinue={onProceed}
        failureText="Not quite right"
        termAudio={card.termAudio}
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
