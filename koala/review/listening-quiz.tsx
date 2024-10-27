import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState, useCallback } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { QuizComp } from "./types";

const REPETITIONS = 1;

export const ListeningQuiz: QuizComp = ({
  quiz: card,
  onGraded,
  onComplete,
}) => {
  // State variables
  const [successfulAttempts, setSuccessfulAttempts] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<"play" | "record" | "done">("play");
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  const transitionToNextPhase = useCallback(
    () => setPhase(phase === "play" ? "record" : "done"),
    [phase],
  );

  const handlePlayClick = async () => {
    await playAudio(card.definitionAudio);
    setPhase("record");
  };

  const handleRecordClick = () => {
    setIsRecording((prev) => !prev);
    isRecording ? voiceRecorder.stop() : voiceRecorder.start();
  };

  async function handleRecordingResult(audioBlob: Blob) {
    setIsRecording(false);
    try {
      const base64Audio = await blobToBase64(await convertBlobToWav(audioBlob));
      const { result: transcription } = await transcribeAudio.mutateAsync({
        audio: base64Audio,
        lang: "ko",
        targetText: card.term,
      });

      if (transcription.trim() === card.term.trim())
        setSuccessfulAttempts((prev) => prev + 1);
      transitionToNextPhase();
    } catch (error) {
      setPhase("play"); // Retry
    }
  }

  const handleFailClick = () => {
    onGraded(Grade.AGAIN);
    onComplete("fail", "You hit the FAIL button");
  };

  const handleDifficultySelect = (grade: Grade) => {
    onGraded(grade);
    onComplete("pass", "");
  };

  useHotkeys([
    [
      "space",
      () => (phase === "play" ? handlePlayClick() : handleRecordClick()),
    ],
  ]);

  useEffect(() => {
    setSuccessfulAttempts(0);
    setIsRecording(false);
    setPhase("play");
  }, [card.term]);

  switch (phase) {
    case "play":
      return (
        <Stack>
          <Text size="xl">{card.term}</Text>
          {card.lessonType == "dictation" && <Text>{card.definition}</Text>}
          <Button onClick={handlePlayClick}>Play</Button>
          <Text>
            Repetitions: {successfulAttempts}/{REPETITIONS}
          </Text>
          <Button variant="outline" color="red" onClick={handleFailClick}>
            Fail
          </Button>
        </Stack>
      );
    case "record":
      return (
        <Stack>
          <Text size="xl">{card.term}</Text>
          <Button onClick={handleRecordClick}>
            {isRecording ? "Stop Recording" : "Record Response"}
          </Button>
          {isRecording && <Text>Recording...</Text>}
          <Text>
            Repetitions: {successfulAttempts}/{REPETITIONS}
          </Text>
          <Button variant="outline" color="red" onClick={handleFailClick}>
            Fail
          </Button>
        </Stack>
      );
    case "done":
      return (
        <Stack>
          <Text>Answer: {card.definition}</Text>
          <Text size="xl">Select difficulty:</Text>
          <DifficultyButtons
            current={undefined}
            onSelectDifficulty={handleDifficultySelect}
          />
        </Stack>
      );
    default:
      return <div>{`Unknown phase: ${phase}`}</div>;
  }
};
