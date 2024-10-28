import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState } from "react";
import { DifficultyButtons } from "./grade-buttons";
import { QuizComp } from "./types";
import { playAudio } from "../play-audio";

export const SpeakingQuiz: QuizComp = (props) => {
  const { quiz: card } = props;
  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<"prompt" | "recording" | "done">("prompt");
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  const handleRecordClick = () => {
    if (isRecording) {
      voiceRecorder.stop();
      setIsRecording(false);
      setPhase("done");
    } else {
      setIsRecording(true);
      setPhase("recording");
      voiceRecorder.start();
    }
  };

  async function handleRecordingResult(audioBlob: Blob) {
    setIsRecording(false);
    await playAudio(card.termAudio);
    setPhase("done");
    const wavBlob = await convertBlobToWav(audioBlob);
    const base64Audio = await blobToBase64(wavBlob);

    transcribeAudio
      .mutateAsync({
        audio: base64Audio,
        targetText: card.term,
        lang: card.langCode as "ko", // e.g., "ko" for Korean
      })
      .then(({ result: userTranscription }) => {
        gradeSpeakingQuiz
          .mutateAsync({
            userInput: userTranscription,
            cardId: card.cardId,
          })
          .then(async ({ isCorrect, feedback }) => {
            const status = isCorrect ? "pass" : "fail";
            const f = status == "pass" ? "" : feedback;
            props.onComplete({
              status,
              feedback: f,
              userResponse: userTranscription,
            });
          });
      });
  }

  // Handle Fail button click
  const handleFailClick = async () => {
    await playAudio(card.termAudio);
    await playAudio(card.definitionAudio);
    props.onGraded(Grade.AGAIN);
    props.onComplete({
      status: "fail",
      feedback: "You clicked 'I Don't Know'.",
      userResponse: "Not provided.",
    });
  };

  // Handle Difficulty selection
  const handleDifficultySelect = (grade: Grade) => {
    props.onGraded(grade);
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
      <Text size="xl">
        {phase == "prompt" ? "Say in target language:" : "Select difficulty"}
      </Text>
      <Text size="xl">{card.definition}</Text>
      {(phase === "prompt" || phase === "recording") && (
        <Button onClick={handleRecordClick}>
          {isRecording ? "Stop Recording" : "Begin Recording, Repeat Phrase"}
        </Button>
      )}
      {isRecording && <Text>Recording...</Text>}
      {(phase === "prompt" || phase === "recording") && (
        <Button variant="outline" color="red" onClick={handleFailClick}>
          I Don't Know
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
