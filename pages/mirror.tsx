import React, { useState, useEffect } from "react";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";

// List of target sentences
const TARGET_SENTENCES = [
  "사람들이 한국말로 말해요.",
  "한국어로 말해주세요.",
  // Add more sentences as needed
];

// Component to display the translation
const TranslationDisplay = ({
  // text,
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
  isProcessing,
  successfulAttempts,
  handleClick,
}: {
  isRecording: boolean;
  isProcessing: boolean;
  successfulAttempts: number;
  handleClick: () => void;
}) => (
  <div>
    <button onClick={handleClick} disabled={isProcessing}>
      {isRecording
        ? "Stop Recording"
        : successfulAttempts >= 3
        ? "GOOD JOB! Click here to see the translation."
        : "Start Recording"}
    </button>
    <p>{successfulAttempts} of 3 attempts OK</p>
  </div>
);

// Component to handle quizzing for a single sentence
export const SentenceQuiz = ({
  term,
  onNextSentence,
  setErrorMessage,
}: {
  term: { term: string; definition: string };
  onNextSentence: () => void;
  setErrorMessage: (error: string) => void;
}) => {
  // State variables
  const [successfulAttempts, setSuccessfulAttempts] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [hasCompletedAttempts, setHasCompletedAttempts] = useState(false);
  const [targetAudioUrl, setTargetAudioUrl] = useState<string | null>(null);

  // TRPC mutations
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const speakText = trpc.speakText.useMutation();

  // Reset state variables when the term changes
  useEffect(() => {
    setSuccessfulAttempts(0);
    setIsRecording(false);
    setIsProcessingRecording(false);
    setHasCompletedAttempts(false);
    setTargetAudioUrl(null);
  }, [term.term]);

  // Fetch target audio when the component mounts or when the term changes
  useEffect(() => {
    const fetchTargetAudio = async () => {
      try {
        const { url: audioUrl } = await speakText.mutateAsync({
          lang: "ko",
          text: term.term,
        });
        setTargetAudioUrl(audioUrl);
      } catch (err) {
        setErrorMessage("Failed to fetch target audio.");
      }
    };
    fetchTargetAudio();
  }, [term.term]);

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
        targetText: term.term,
      });

      // Compare the transcription with the target sentence
      if (transcription.trim() === term.term.trim()) {
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
      // Play the target audio
      if (targetAudioUrl) {
        playAudio(targetAudioUrl);
      } else {
        setErrorMessage("Target audio is not available.");
      }
      // Start recording
      setIsRecording(true);
      voiceRecorder.start();
    }
  };

  if (hasCompletedAttempts) {
    return (
      <div>
        <button onClick={onNextSentence}>Next Sentence</button>
        <TranslationDisplay text={term.term} translation={term.definition} />
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
    </div>
  );
};

export default function Mirror() {
  // State variables
  const [terms, setTerms] = useState<{ term: string; definition: string }[]>(
    [],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // TRPC mutation
  const translateText = trpc.translateText.useMutation();

  // Fetch translations for all sentences
  useEffect(() => {
    const translateSentences = async () => {
      try {
        const translatedTerms = await Promise.all(
          TARGET_SENTENCES.map(async (sentence) => {
            const { result: translation } = await translateText.mutateAsync({
              text: sentence,
              lang: "ko",
            });
            return { term: sentence, definition: translation };
          }),
        );
        setTerms(translatedTerms);
      } catch (err) {
        setErrorMessage("Failed to translate sentences.");
      }
    };
    translateSentences();
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
      term={currentTerm}
      onNextSentence={() => setCurrentIndex(currentIndex + 1)}
      setErrorMessage={setErrorMessage}
    />
  );
}
