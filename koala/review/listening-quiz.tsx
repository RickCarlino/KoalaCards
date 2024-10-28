import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Center, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState, useCallback } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { QuizComp } from "./types";

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
    await playAudio(card.termAudio);
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
    onComplete({
      status: "fail",
      feedback: "You hit the FAIL button.",
      userResponse: "Not provided.",
    });
  };

  const handleDifficultySelect = (grade: Grade) => {
    onGraded(grade);
    onComplete({
      status: "pass",
      feedback: "",
      userResponse: "Not yet supported for listening quizzes.",
    });
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

  const isDictation = card.lessonType === "dictation";
  const showTerm = successfulAttempts === 0 || isDictation;
  switch (phase) {
    case "play":
      return (
        <Stack>
          {isDictation && (
            <Center>
              <Text size="xl">NEW CARD</Text>
            </Center>
          )}
          {showTerm && <Text>Term: {card.term}</Text>}
          {isDictation && <Text>Meaning: {card.definition}</Text>}
          <Button onClick={handlePlayClick}>
            Listen to Audio and Proceed to Exercise
          </Button>
          <Button variant="outline" color="red" onClick={handleFailClick}>
            I Don't Know
          </Button>
        </Stack>
      );
    case "record":
      return (
        <Stack>
          <Text size="xl">{isDictation && card.term}</Text>
          <Button onClick={handleRecordClick}>
            {isRecording ? "Stop Recording" : "Record and Repeat"}
          </Button>
          {phase === "record" && (
            <Button onClick={() => playAudio(card.termAudio)}>
              Play Audio Again
            </Button>
          )}
          {!isDictation && (
            <Button variant="outline" color="red" onClick={handleFailClick}>
              I Don't Know
            </Button>
          )}
        </Stack>
      );
    case "done":
      return (
        <Stack>
          <Center>
            <Text size="xl">Select Difficulty</Text>
          </Center>
          <Text>Term: {card.term}</Text>
          <Text>Definition: {card.definition}</Text>
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
