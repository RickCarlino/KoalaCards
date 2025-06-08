import { Stack, Text, Image, Button } from "@mantine/core";
import { CardUI } from "../types";
import { useEffect, useState } from "react";
import { useRepair } from "../use-repair";
import { LangCode } from "@/koala/shared-types";

type Phase = "ready" | "processing" | "success" | "failure";

const FailureView = ({
  imageURL,
  term,
  definition,
  userTranscription,
  onContinue,
}: {
  imageURL?: string;
  term: string;
  definition: string;
  userTranscription: string;
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
        Not quite right
      </Text>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>

      <Text ta="center" size="sm" c="dimmed">
        You said: "{userTranscription}"
      </Text>

      <Text ta="center" c="dimmed">
        We'll review this again later.
      </Text>

      <Button onClick={onContinue} variant="light" color="blue">
        Continue
      </Button>
    </Stack>
  );
};

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
  const [phase, setPhase] = useState<Phase>("ready");
  const [userTranscription, setUserTranscription] = useState<string>("");

  const { processAudio } = useRepair({
    cardId: card.cardId,
    targetText: card.term,
    langCode: card.langCode as LangCode,
  });

  // Reset phase when step changes
  useEffect(() => {
    setPhase("ready");
    setUserTranscription("");
  }, [currentStepUuid]);

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

  // Listen for recordings from TopBar
  useEffect(() => {
    const currentRecording = recordings?.[currentStepUuid];
    if (currentRecording?.audio) {
      processRecording(currentRecording.audio);
    }
  }, [recordings?.[currentStepUuid]?.audio]);

  const handleContinue = () => {
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
        onContinue={handleContinue}
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
        onContinue={handleContinue}
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
      {card.imageURL && (
        <Image
          src={card.imageURL}
          alt={`Image: ${term}`}
          maw="100%"
          mah={240}
          fit="contain"
        />
      )}

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
