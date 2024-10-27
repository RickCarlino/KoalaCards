import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { QuizComp } from "./types";

export const SpeakingQuiz: QuizComp = (props) => {
  const { quiz: card } = props;

  // State variables
  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<"prompt" | "recording" | "done">("prompt");

  // TRPC mutations (stubbed if missing)
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();

  // Voice recorder hook
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  // Handle Record button click
  const handleRecordClick = () => {
    if (isRecording) {
      // Stop recording
      voiceRecorder.stop();
      setIsRecording(false);
      setPhase("done");
    } else {
      // Start recording
      setIsRecording(true);
      setPhase("recording");
      voiceRecorder.start();
    }
  };

  // Handle recording result
  async function handleRecordingResult(audioBlob: Blob) {
    setIsRecording(false);
    // Process the recording
    try {
      // Convert the recorded audio blob to WAV and then to base64
      const wavBlob = await convertBlobToWav(audioBlob);
      const base64Audio = await blobToBase64(wavBlob);

      // Start transcription and grading in the background without awaiting
      transcribeAudio
        .mutateAsync({
          audio: base64Audio,
          targetText: card.term,
          lang: card.langCode as "ko", // e.g., "ko" for Korean
        })
        .then(({ result: userTranscription }) => {
          // After transcription, start grading
          gradeSpeakingQuiz.mutateAsync({
            userInput: userTranscription,
            cardId: card.cardId,
          });
        });
    } finally {
      // Proceed to the 'done' phase to allow difficulty selection
      setPhase("done");
    }
  }

  // Handle Fail button click
  const handleFailClick = () => {
    props.onComplete(Grade.AGAIN);
  };

  // Handle Difficulty selection
  const handleDifficultySelect = (grade: Grade) => {
    props.onComplete(grade);
  };

  // Handle space key press
  useHotkeys([
    [
      "space",
      () => {
        if (phase === "prompt" || phase === "recording") {
          handleRecordClick();
        }
      },
    ],
  ]);

  // Reset state when card changes
  useEffect(() => {
    setIsRecording(false);
    setPhase("prompt");
  }, [card.term]);

  return (
    <Stack>
      <Text size="xl">Say in target language:</Text>
      <Text size="xl">{card.definition}</Text>

      {(phase === "prompt" || phase === "recording") && (
        <Button onClick={handleRecordClick}>
          {isRecording ? "Stop Recording" : "Record Response"}
        </Button>
      )}

      {isRecording && <Text>Recording...</Text>}

      {(phase === "prompt" || phase === "recording") && (
        <Button variant="outline" color="red" onClick={handleFailClick}>
          Fail
        </Button>
      )}

      {phase === "done" && (
        <DifficultyButtons
          current={undefined}
          onSelectDifficulty={handleDifficultySelect}
        />
      )}
    </Stack>
  );
};
