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
import { getLangName } from "../get-lang-name";
import { ServerExplanation } from "./ServerExplanation";

async function playSequence(...audioURLs: (string | undefined)[]) {
  for (const url of audioURLs) {
    if (!url) continue;
    await playAudio(url);
  }
}

export const SpeakingQuiz: QuizComp = (props) => {
  const { onComplete, onGraded } = props;
  const card = props.quiz.quiz;
  const RECORDING_TIME = 8;
  
  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<"prompt" | "recording" | "done">("prompt");
  const [timeLeft, setTimeLeft] = useState(RECORDING_TIME);

  const { playbackPercentage } = useUserSettings();
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();

  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  useEffect(() => {
    playFX("/speaking-beep.wav");
  }, [card.term]);

  useEffect(() => {
    resetQuizState();
  }, [card.term]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    
    if (!isRecording) {
      return () => {};
    }
    
    if (timeLeft <= 0) {
      handleRecordClick();
      return () => {};
    }
    
    timerId = setInterval(() => {
      setTimeLeft(prevTime => prevTime - 1);
    }, 1000);

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isRecording, timeLeft]);

  function resetQuizState() {
    setIsRecording(false);
    setPhase("prompt");
    setTimeLeft(RECORDING_TIME);
  }

  function handleRecordClick() {
    if (isRecording) {
      voiceRecorder.stop();
      console.time(card.term);
      setIsRecording(false);
      setPhase("done");
      return;
    }

    setIsRecording(true);
    setPhase("recording");
    setTimeLeft(RECORDING_TIME);
    voiceRecorder.start();
  }

  async function handleRecordingResult(audioBlob: Blob) {
    setIsRecording(false);
    setPhase("done");
    
    await playAudio(card.termAudio);

    const wavBlob = await convertBlobToWav(audioBlob);
    const base64Audio = await blobToBase64(wavBlob);

    if (Math.random() < playbackPercentage) {
      await playAudio(base64Audio);
    }

    processAudioForGrading(base64Audio);
  }
  
  function processAudioForGrading(base64Audio: string) {
    let userTranscription = "";
    
    transcribeAudio
      .mutateAsync({
        audio: base64Audio,
        targetText: card.term,
        lang: card.langCode as LangCode,
      })
      .then(({ result }) => {
        userTranscription = result;
        return gradeSpeakingQuiz.mutateAsync({
          userInput: userTranscription,
          quizID: card.quizId,
        });
      })
      .then(({ isCorrect, feedback }) => {
        onComplete({
          status: isCorrect ? "pass" : "fail",
          feedback: isCorrect ? "" : feedback,
          userResponse: userTranscription,
        });
        console.timeEnd(card.term);
      });
  }

  async function handleFailClick() {
    await playSequence(
      card.termAudio,
      card.definitionAudio,
      card.termAudio,
      card.definitionAudio,
      card.termAudio,
    );

    onGraded(Grade.AGAIN);

    setTimeout(() => {
      onComplete({
        status: "fail",
        feedback: "You gave up.",
        userResponse: "",
      });
    }, 1000);
  }

  useHotkeys([
    [
      HOTKEYS.RECORD,
      (e) => {
        e.preventDefault();
        if (phase === "prompt" || phase === "recording") {
          handleRecordClick();
        }
      },
    ],
  ]);

  function handleDifficultySelect(grade: Grade) {
    onGraded(grade);
  }

  function renderPromptControls() {
    return (
      <>
        <Button onClick={handleRecordClick} color={isRecording ? "red" : "blue"}>
          {isRecording ? `Stop Recording (${timeLeft}s)` : "Begin Recording, Repeat Phrase"}
        </Button>
        {isRecording && <Text>Recording...</Text>}
        <FailButton onClick={handleFailClick} />
      </>
    );
  }

  function renderGradingInfo() {
    const { serverGradingResult, serverResponse, response } = props.quiz;
    
    if (serverGradingResult === "pass") {
      return <Text size="xs">Congrats! You got this one correct.</Text>;
    }
    
    if (serverGradingResult === "fail") {
      const expected = serverResponse || "";
      const actual = response || expected;
      return <ServerExplanation expected={expected} actual={actual} heading="" />;
    }
    
    return (
      <Text size="xs">
        Grading in progress. You can keep waiting or review your feedback at
        the end of the lesson.
      </Text>
    );
  }
  
  function renderDoneControls() {
    return (
      <>
        {renderGradingInfo()}
        <DifficultyButtons
          quiz={card}
          current={undefined}
          onSelectDifficulty={handleDifficultySelect}
        />
      </>
    );
  }

  function getHeaderText() {
    return phase === "prompt" 
      ? `Say in ${getLangName(card.langCode)}`
      : "Select Next Review Date";
  }

  return (
    <Stack>
      <Text size="xl">{getHeaderText()}</Text>
      <Text size="xl">{card.definition}</Text>
      {(phase === "prompt" || phase === "recording") && renderPromptControls()}
      {phase === "done" && renderDoneControls()}
    </Stack>
  );
};
