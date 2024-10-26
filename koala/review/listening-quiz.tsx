import React, { useState, useEffect } from "react";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useHotkeys } from "@mantine/hooks";
import { QuizComp } from "./types";
import { Grade } from "femto-fsrs";
import { DifficultyButtons } from "./grade-buttons";

const RecordingControls = ({
  isRecording,
  successfulAttempts,
  failedAttempts,
  isProcessingRecording,
  handleClick,
}: {
  isRecording: boolean;
  successfulAttempts: number;
  failedAttempts: number;
  isProcessingRecording: boolean;
  handleClick: () => void;
}) => {
  let message: string;
  if (isRecording) {
    message = "Recording...";
  } else {
    message = "Start recording";
  }

  return (
    <div>
      <button onClick={handleClick} disabled={successfulAttempts >= 3}>
        {message}
      </button>
      <p>{successfulAttempts} repetitions correct.</p>
      <p>{isProcessingRecording ? 1 : 0} repetitions awaiting grade.</p>
      <p>{failedAttempts} repetitions failed.</p>
      <p>{3 - successfulAttempts} repetitions left.</p>
    </div>
  );
};

// Component to handle quizzing for a single sentence
export const ListeningQuiz: QuizComp = (props) => {
  const card = props.quiz;
  // State variables
  const [successfulAttempts, setSuccessfulAttempts] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [grade, setGrade] = useState<Grade>(Grade.GOOD);

  // TRPC mutations
  const transcribeAudio = trpc.transcribeAudio.useMutation();

  // Voice recorder hook
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  // Handle button click
  const handleClick = async () => {
    if (successfulAttempts >= 3) {
      // Do nothing if already completed
      return;
    }

    if (isRecording) {
      // Stop recording
      voiceRecorder.stop();
      setIsRecording(false);
    } else {
      playAudio(card.definitionAudio);
      // Start recording
      setIsRecording(true);
      voiceRecorder.start();
    }
  };

  // Use hotkeys to trigger handleClick on space bar press
  useHotkeys([["space", handleClick]]);

  // Reset state variables when the term changes
  useEffect(() => {
    setSuccessfulAttempts(0);
    setFailedAttempts(0);
    setIsRecording(false);
    setIsProcessingRecording(false);
  }, [card.term]);

  // Handle the result after recording is finished
  async function handleRecordingResult(audioBlob: Blob) {
    setIsProcessingRecording(true);
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
      } else {
        setFailedAttempts((prev) => prev + 1);
      }
    } finally {
      setIsProcessingRecording(false);
    }
  }

  // Effect to handle successful completion
  useEffect(() => {
    if (successfulAttempts >= 3) {
      // Play the translation audio
      playAudio(card.termAudio).then(() => {
        props.onComplete(grade);
      });
    }
  }, [successfulAttempts]);

  return (
    <div>
      <RecordingControls
        isRecording={isRecording}
        isProcessingRecording={isProcessingRecording}
        successfulAttempts={successfulAttempts}
        failedAttempts={failedAttempts}
        handleClick={handleClick}
      />
      {successfulAttempts === 0 && <p>{card.term}</p>}
      <DifficultyButtons current={grade} onSelectDifficulty={setGrade} />
    </div>
  );
};
