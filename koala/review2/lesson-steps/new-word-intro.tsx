import { playAudio } from "@/koala/play-audio";
import { Stack, Text, Image } from "@mantine/core";
import { CardUI } from "../types";
import { useEffect, useState } from "react";
import { useVoiceTranscription } from "../use-voice-transcription";
import { VisualDiff } from "@/koala/review/visual-diff";
import { LangCode } from "@/koala/shared-types";

type Phase = "ready" | "processing" | "retry" | "success";

export const NewWordIntro: CardUI = ({ card, recordings, onProceed, currentStepUuid }) => {
  const { term, definition } = card;
  const [phase, setPhase] = useState<Phase>("ready");
  const [userTranscription, setUserTranscription] = useState<string>("");

  const { transcribe } = useVoiceTranscription({
    targetText: card.term,
    langCode: card.langCode as LangCode,
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
        // Success - show success state, play audio, then proceed
        setPhase("success");
        if (card.definitionAudio) {
          await playAudio(card.definitionAudio);
        }
        await playAudio(card.termAudio);
        onProceed();
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

  const renderContent = () => {
    switch (phase) {
      case "ready":
        return (
          <Text ta="center" c="dimmed">
            Press the record button above and repeat the phrase.
          </Text>
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
          <Text ta="center" c="green" fw={500}>
            Correct!
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

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>

      {renderContent()}
    </Stack>
  );
};
