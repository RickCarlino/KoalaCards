import React, { useState, useEffect } from "react";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";

const TranslationDisplay = ({
  translation,
}: {
  text: string;
  translation: string;
}) => (
  <div>
    <h2>Translation</h2>
    <p>{translation}</p>
  </div>
);

// Component to handle recording controls
const RecordingControls = ({
  isRecording,
  successfulAttempts,
  handleClick,
}: {
  isRecording: boolean;
  isProcessing: boolean;
  successfulAttempts: number;
  handleClick: () => void;
}) => {
  let message: string;
  if (isRecording) {
    message = "Recording...";
  } else {
    message = "Start recording";
  }
  if (successfulAttempts >= 3) {
    message = "Next";
  }

  return (
    <div>
      <button onClick={handleClick}>
        {message}
      </button>
      <p>{successfulAttempts} of 3 attempts OK</p>
    </div>
  );
};

// Component to handle quizzing for a single sentence
export const SentenceQuiz = ({
  card,
  onNextSentence,
  setErrorMessage,
}: {
  card: { term: string; definition: string; audioUrl: string };
  onNextSentence: () => void;
  setErrorMessage: (error: string) => void;
}) => {
  // State variables
  const [successfulAttempts, setSuccessfulAttempts] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [hasCompletedAttempts, setHasCompletedAttempts] = useState(false);

  // TRPC mutations
  const transcribeAudio = trpc.transcribeAudio.useMutation();

  // Reset state variables when the term changes
  useEffect(() => {
    setSuccessfulAttempts(0);
    setIsRecording(false);
    setIsProcessingRecording(false);
    setHasCompletedAttempts(false);
  }, [card.term]);

  // Handle the result after recording is finished
  const handleRecordingResult = async (audioBlob: Blob) => {
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
      }
    } catch (err) {
      setErrorMessage("Error processing the recording.");
    } finally {
      setIsProcessingRecording(false);
    }
  };

  // Voice recorder hook
  const voiceRecorder = useVoiceRecorder(handleRecordingResult);

  // Handle button click
  const handleClick = async () => {
    if (successfulAttempts >= 3) {
      // User has completed the required number of attempts
      setHasCompletedAttempts(true);
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

  if (hasCompletedAttempts) {
    return (
      <div>
        <button onClick={onNextSentence}>Next Sentence</button>
        <TranslationDisplay text={card.term} translation={card.definition} />
      </div>
    );
  }

  return (
    <div>
      <RecordingControls
        isRecording={isRecording}
        isProcessing={isProcessingRecording}
        successfulAttempts={successfulAttempts}
        handleClick={handleClick}
      />
      {successfulAttempts < 3 && card.term}
    </div>
  );
};
type Card = {
  term: string;
  definition: string;
  audioUrl: string;
};

export default function Mirror() {
  // State variables
  const [terms, setTerms] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getMirrorCards = trpc.getMirrorCards.useMutation({});
  // Fetch translations for all sentences
  useEffect(() => {
    const getSentences = async () => {
      try {
        const translatedTerms = await getMirrorCards.mutateAsync({});
        setTerms(translatedTerms);
      } catch (err) {
        setErrorMessage("Failed to translate sentences.");
      }
    };
    getSentences();
  }, []);

  if (errorMessage) {
    return <div>Error: {errorMessage}</div>;
  }

  if (terms.length === 0) {
    return <div>Loading sentences...</div>;
  }

  if (currentIndex >= terms.length) {
    return (
      <div>
        <button onClick={() => setCurrentIndex(0)}>Start Over</button>
        <p>All sentences completed!</p>
      </div>
    );
  }

  const currentTerm = terms[currentIndex];

  return (
    <SentenceQuiz
      card={currentTerm}
      onNextSentence={() => setCurrentIndex(currentIndex + 1)}
      setErrorMessage={setErrorMessage}
    />
  );
}
