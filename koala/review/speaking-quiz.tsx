import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState } from "react";
import { playAudio } from "../play-audio";
import { playFX } from "../play-fx";
import { useUserSettings } from "../settings-provider";
import { FailButton } from "./fail-button";
import { DifficultyButtons } from "./grade-buttons";
import { HOTKEYS } from "./hotkeys";
import { QuizComp } from "./types";
import { LangCode } from "../shared-types";

export const SpeakingQuiz: QuizComp = (props) => {
  const { quiz: card } = props;
  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<"prompt" | "recording" | "done">("prompt");
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);
  const { playbackPercentage } = useUserSettings();
  useEffect(() => {
    playFX("/speaking-beep.wav");
  }, [card.term]);
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
    Math.random() < playbackPercentage && (await playAudio(base64Audio));
    transcribeAudio
      .mutateAsync({
        audio: base64Audio,
        targetText: card.term,
        lang: card.langCode as LangCode,
      })
      .then(({ result: userTranscription }) => {
        gradeSpeakingQuiz
          .mutateAsync({
            userInput: userTranscription,
            quizID: card.quizId,
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
  const onFailClick = async () => {
    await playAudio(card.termAudio);
    await playAudio(card.definitionAudio);
    await playAudio(card.termAudio);
    await playAudio(card.definitionAudio);
    await playAudio(card.termAudio);

    props.onGraded(Grade.AGAIN);
    setTimeout(() => {
      console.log(`=== REMEMBER: TO FIX THIS HACK ===`);
      props.onComplete({
        status: "fail",
        feedback: "You clicked 'I Don't Know'.",
        userResponse: "Not provided.",
      });
    }, 1000);
  };

  // Handle Difficulty selection
  const handleDifficultySelect = (grade: Grade) => {
    props.onGraded(grade);
  };

  // Handle space key press
  useHotkeys([
    [
      HOTKEYS.RECORD,
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
        <FailButton onClick={onFailClick} />
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
