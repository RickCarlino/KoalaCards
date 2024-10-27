import React, { useState, useEffect } from "react";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";
import { useHotkeys } from "@mantine/hooks";

type Card = {
  term: string;
  definition: string;
  termAudio: string;
  audioUrl: string;
};

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
    message = "Repeat What You Hear Now";
  } else {
    message = "Click to Hear";
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
export const SentenceQuiz = ({
  card,
  setErrorMessage,
  onCardCompleted,
}: {
  card: Card;
  setErrorMessage: (error: string) => void;
  onCardCompleted: () => void;
}) => {
  // State variables
  const [successfulAttempts, setSuccessfulAttempts] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);

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
      playAudio(card.audioUrl);
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
    } catch (err) {
      setErrorMessage("Error processing the recording.");
    } finally {
      setIsProcessingRecording(false);
    }
  }

  // Effect to handle successful completion
  useEffect(() => {
    if (successfulAttempts >= 3) {
      // Play the translation audio
      playAudio(card.termAudio).then(() => {
        // After audio finishes, proceed to next sentence
        onCardCompleted();
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
    </div>
  );
};

export default function Mirror() {
  // State variables
  const [terms, setTerms] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getMirrorCards = trpc.getMirrorCards.useMutation({});
  // Fetch translations for all sentences
  const fetchCards = async () => {
    try {
      const translatedTerms = await getMirrorCards.mutateAsync({});
      setTerms(translatedTerms);
      setCurrentIndex(0);
    } catch (err) {
      setErrorMessage("Failed to fetch sentences.");
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleCardCompleted = () => {
    setCurrentIndex((prevIndex) => prevIndex + 1);
  };

  // When the list is emptied, re-fetch more cards from the server
  useEffect(() => {
    if (currentIndex >= terms.length) {
      // Re-fetch more cards from the server
      fetchCards();
    }
  }, [currentIndex, terms.length]);

  if (errorMessage) {
    return <div>Error: {errorMessage}</div>;
  }

  if (terms.length === 0) {
    return <div>Loading sentences...</div>;
  }

  const currentTerm = terms[currentIndex];

  return (
    <SentenceQuiz
      card={currentTerm}
      onCardCompleted={handleCardCompleted}
      setErrorMessage={setErrorMessage}
    />
  );
}
