import { useState, useEffect } from "react";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { trpc } from "@/koala/trpc-config";

const TARGET_SENTENCES = ["사람들이 한국말로 말해요.", "한국어로 말해주세요."];
const TARGET_SENTENCE = TARGET_SENTENCES[0]; // Just an example

export default function Mirror() {
  const [attempts, setAttempts] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetAudioUrl, setTargetAudioUrl] = useState<string | null>(null);

  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const translateText = trpc.translateText.useMutation();
  const speakText = trpc.speakText.useMutation();

  useEffect(() => {
    const fetchTargetAudio = async () => {
      try {
        const { url: audioUrl } = await speakText.mutateAsync({
          lang: "ko",
          text: TARGET_SENTENCE,
        });
        setTargetAudioUrl(audioUrl);
      } catch (err) {
        setError("Failed to fetch target audio.");
      }
    };
    fetchTargetAudio();
  }, []);

  const handleRecordingResult = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Convert blob to base64 WAV format
      const wavBlob = await convertBlobToWav(audioBlob);
      const base64Audio = await blobToBase64(wavBlob);

      // Transcribe the audio
      const { result: transcription } = await transcribeAudio.mutateAsync({
        audio: base64Audio,
        lang: "ko",
        targetText: TARGET_SENTENCE,
      });

      console.log("Transcription:", transcription);
      console.log("Target sentence:", TARGET_SENTENCE);
      // Compare transcription with target sentence
      if (transcription.trim() === TARGET_SENTENCE.trim()) {
        setAttempts((prev) => prev + 1);
      }
    } catch (err) {
      setError("Error processing the recording.");
    } finally {
      setIsProcessing(false);
    }
  };

  const vr = useVoiceRecorder(handleRecordingResult);

  const handleClick = async () => {
    if (attempts >= 3) {
      // User has completed the task
      setShowTranslation(true);
      return;
    }

    if (isRecording) {
      // Stop recording
      vr.stop();
      setIsRecording(false);
    } else {
      // Play the target audio (don't wait for it to finish)
      if (targetAudioUrl) {
        playAudio(targetAudioUrl);
      } else {
        setError("Target audio is not available.");
      }
      setIsRecording(true);
      vr.start();
    }
  };

  const TranslationDisplay = () => {
    const [translation, setTranslation] = useState<string | null>(null);

    useEffect(() => {
      const fetchTranslation = async () => {
        try {
          const { result: translatedText } = await translateText.mutateAsync({
            text: TARGET_SENTENCE,
            lang: "ko",
          });
          setTranslation(translatedText);
        } catch (err) {
          setError("Failed to fetch translation.");
        }
      };
      fetchTranslation();
    }, []);

    if (error) {
      return <div>Error: {error}</div>;
    }

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

  return (
    <div>
      {error && <div>Recording error: {error}</div>}
      {showTranslation ? (
        <TranslationDisplay />
      ) : (
        <div>
          <button onClick={handleClick} disabled={isProcessing}>
            {isRecording
              ? "Stop Recording"
              : attempts >= 3
              ? "GOOD JOB! Click here to see the translation."
              : "Start Recording"}
          </button>
          <p>{attempts} of 3 attempts OK</p>
        </div>
      )}
    </div>
  );
}
