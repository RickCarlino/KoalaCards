import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { QuizComp } from "./types";

export const ListeningQuiz: QuizComp = (props) => {
  const { quiz: card } = props;

  // State variables
  const [successfulAttempts, setSuccessfulAttempts] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<"play" | "record" | "done">("play");

  // Constants
  const REPETITIONS = 3;

  // TRPC mutation for transcribing audio
  const transcribeAudio = trpc.transcribeAudio.useMutation();

  // Voice recorder hook
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  // Handle Play button click
  const handlePlayClick = async () => {
    await playAudio(card.definitionAudio);
    // After audio has finished playing, move to 'record' phase
    setPhase("record");
  };

  // Handle Record button click
  const handleRecordClick = () => {
    if (isRecording) {
      // Stop recording
      voiceRecorder.stop();
      setIsRecording(false);
    } else {
      // Start recording
      setIsRecording(true);
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

      // Transcribe the audio
      const { result: transcription } = await transcribeAudio.mutateAsync({
        audio: base64Audio,
        lang: "ko",
        targetText: card.term,
      });

      // Compare the transcription with the target sentence
      if (transcription.trim() === card.term.trim()) {
        setSuccessfulAttempts((prev) => prev + 1);
      }

      // Check if repetitions are completed
      if (successfulAttempts + 1 >= REPETITIONS) {
        // Repetitions completed
        setPhase("done");
      } else {
        // Move back to 'play' phase for next repetition
        setPhase("play");
      }
    } catch (error) {
      // Handle error if needed
      // Move back to 'play' phase to retry
      setPhase("play");
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
        if (phase === "play") {
          handlePlayClick();
        } else if (phase === "record") {
          handleRecordClick();
        }
      },
    ],
  ]);

  // Reset state when card changes
  useEffect(() => {
    setSuccessfulAttempts(0);
    setIsRecording(false);
    setPhase("play");
  }, [card.term]);

  return (
    <Stack>
      {/* Display the sentence */}
      <Text size="xl">{card.term}</Text>

      {/* Play button during 'play' phase */}
      {phase === "play" && <Button onClick={handlePlayClick}>Play</Button>}

      {/* Record Response button during 'record' phase */}
      {phase === "record" && (
        <Button onClick={handleRecordClick}>
          {isRecording ? "Stop Recording" : "Record Response"}
        </Button>
      )}

      {/* Display recording status */}
      {isRecording && <Text>Recording...</Text>}

      {/* Show repetitions count */}
      {phase !== "done" && (
        <Text>
          Repetitions: {successfulAttempts}/{REPETITIONS}
        </Text>
      )}

      {/* Fail button during 'play' and 'record' phases */}
      {phase !== "done" && (
        <Button variant="outline" color="red" onClick={handleFailClick}>
          Fail
        </Button>
      )}

      {/* Difficulty buttons during 'done' phase */}
      {phase === "done" && (
        <DifficultyButtons
          current={undefined}
          onSelectDifficulty={handleDifficultySelect}
        />
      )}
    </Stack>
  );
};
