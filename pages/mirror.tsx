import React, { useState, useEffect } from "react";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";

// List of target sentences
const TARGET_SENTENCES = ["사람들이 한국말로 말해요.", "한국어로 말해주세요."];
const TARGET_SENTENCE = TARGET_SENTENCES[0]; // Current target sentence

// Component to display the translation
const TranslationDisplay = ({
  text,
  setError,
}: {
  text: string;
  setError: (error: string) => void;
}) => {
  const [translation, setTranslation] = useState<string | null>(null);
  const translateText = trpc.translateText.useMutation();

  useEffect(() => {
    const fetchTranslation = async () => {
      try {
        const { result: translatedText } = await translateText.mutateAsync({
          text,
          lang: "ko",
        });
        setTranslation(translatedText);
      } catch (err) {
        setError("Failed to fetch translation.");
      }
    };
    fetchTranslation();
  }, [text]);

  if (!translation) {
    return <div>Loading translation...</div>;
  }

  return (
    <div>
      <h2>Translation</h2>
      <p>{translation}</p>
    </div>
  );
};

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

export default function Mirror() {
  // State variables
  const [successfulAttempts, setSuccessfulAttempts] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [hasCompletedAttempts, setHasCompletedAttempts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetAudioUrl, setTargetAudioUrl] = useState<string | null>(null);

  // TRPC mutations
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const speakText = trpc.speakText.useMutation();

  // Fetch target audio on component mount
  useEffect(() => {
    const fetchTargetAudio = async () => {
      try {
        const { url: audioUrl } = await speakText.mutateAsync({
          lang: "ko",
          text: TARGET_SENTENCE,
        });
        setTargetAudioUrl(audioUrl);
      } catch (err) {
        setErrorMessage("Failed to fetch target audio.");
      }
    };
    fetchTargetAudio();
  }, []);

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
        targetText: TARGET_SENTENCE,
      });

      // Compare the transcription with the target sentence
      if (transcription.trim() === TARGET_SENTENCE.trim()) {
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

  if (errorMessage) {
    return <div>Error: {errorMessage}</div>;
  }

  if (hasCompletedAttempts) {
    return (
      <div>
        <TranslationDisplay text={TARGET_SENTENCE} setError={setErrorMessage} />
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
}
