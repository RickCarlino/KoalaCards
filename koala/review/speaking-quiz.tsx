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

/** A helper to sequentially play any number of audio files. */
async function playSequence(...audioURLs: (string | undefined)[]) {
  for (const url of audioURLs) {
    if (!url) continue;
    await playAudio(url);
  }
}

export const SpeakingQuiz: QuizComp = (props) => {
  const { quiz: card, onComplete, onGraded } = props;

  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<"prompt" | "recording" | "done">("prompt");

  const { playbackPercentage } = useUserSettings();
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const gradeSpeakingQuiz = trpc.gradeSpeakingQuiz.useMutation();

  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  /**
   * Plays a beep FX whenever the quiz term changes.
   */
  useEffect(() => {
    playFX("/speaking-beep.wav");
  }, [card.term]);

  /**
   * Reset recording state and phase whenever card changes.
   */
  useEffect(() => {
    setIsRecording(false);
    setPhase("prompt");
  }, [card.term]);

  /**
   * Toggle recording based on the current phase/recording state.
   */
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
    voiceRecorder.start();
  }

  /**
   * Once the recording is done, this is called. We:
   * 1. Convert to WAV + base64
   * 2. Optionally play the user’s recording
   * 3. Transcribe and grade
   * 4. Signal completion with feedback
   */
  async function handleRecordingResult(audioBlob: Blob) {
    setIsRecording(false);

    // Provide immediate audio feedback by replaying the "correct" term
    await playAudio(card.termAudio);

    setPhase("done");

    const wavBlob = await convertBlobToWav(audioBlob);
    const base64Audio = await blobToBase64(wavBlob);

    // Optionally, play user’s own audio
    if (Math.random() < playbackPercentage) {
      await playAudio(base64Audio);
    }

    let userTranscription = "";
    // Send to server for grading.
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

  /**
   * If the user doesn't know the term, we consider that a "fail".
   */
  async function handleFailClick() {
    // Play the card's audio multiple times to help the user memorize
    await playSequence(
      card.termAudio,
      card.definitionAudio,
      card.termAudio,
      card.definitionAudio,
      card.termAudio,
    );

    onGraded(Grade.AGAIN);

    // Wait slightly to let the audio finish before marking quiz complete
    setTimeout(() => {
      console.log(`=== REMEMBER: TO FIX THIS HACK ===`);
      onComplete({
        status: "fail",
        feedback: "You gave up.",
        userResponse: "",
      });
    }, 1000);
  }

  /**
   * Hook for the spacebar to start/stop recording.
   */
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

  /**
   * The user has chosen a difficulty rating.
   * Pass that back up and it will eventually mark the card with that rating.
   */
  function handleDifficultySelect(grade: Grade) {
    onGraded(grade);
  }

  const renderPromptControls = () => (
    <>
      <Button onClick={handleRecordClick} color={isRecording ? "red" : "blue"}>
        {isRecording ? "Stop Recording" : "Begin Recording, Repeat Phrase"}
      </Button>
      {isRecording && <Text>Recording...</Text>}
      <FailButton onClick={handleFailClick} />
    </>
  );

  const renderDoneControls = () => (
    <DifficultyButtons
      quiz={card}
      current={undefined}
      onSelectDifficulty={handleDifficultySelect}
    />
  );

  function getHeaderText() {
    if (phase === "prompt") {
      return `Say in ${getLangName(card.langCode)}`;
    }
    return "Select Next Review Date";
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
