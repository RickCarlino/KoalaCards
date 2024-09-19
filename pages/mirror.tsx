import { useState } from "react";
import { playAudio } from "@/koala/play-audio";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { trpc } from "@/koala/trpc-config";

export default function Mirror() {
  const [transcription, setTranscription] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const translateText = trpc.translateText.useMutation();
  const speakText = trpc.speakText.useMutation();

  const vr = useVoiceRecorder(async (result: Blob) => {
    setIsProcessing(true);

    try {
      // Convert blob to base64 WAV format
      const wavBlob = await convertBlobToWav(result);
      const base64Audio = await blobToBase64(wavBlob);

      // Transcribe the audio
      const { result: korean } = await transcribeAudio.mutateAsync({
        audio: base64Audio,
        lang: "ko",
        targetText: "사람들이 한국말로 말해요.",
      });
      setTranscription(korean);

      // Translate the transcription to Korean
      const { result: translatedText } = await translateText.mutateAsync({
        text: korean,
        lang: "ko",
      });

      setTranslation(translatedText);

      // Speak the Korean translation out loud
      const { url: audioKO } = await speakText.mutateAsync({
        lang: "ko",
        text: korean,
      });

      // Speak the original English transcription via TTS
      const { url: audioEN } = await speakText.mutateAsync({
        lang: "en",
        text: translatedText,
      });

      // Play back the original voice recording
      await playAudio(base64Audio);
      await playAudio(audioKO);
      await playAudio(audioEN);
    } catch (error) {
      console.error("Error processing voice recording:", error);
    } finally {
      setIsProcessing(false);
    }
  });

  const handleClick = () => {
    if (vr.isRecording) {
      vr.stop();
    } else {
      vr.start();
    }
  };

  if (vr.error) {
    return <div>Recording error: {JSON.stringify(vr.error)}</div>;
  }

  return (
    <div>
      <button onClick={handleClick} disabled={isProcessing}>
        {vr.isRecording ? "Stop" : "Start"}
      </button>

      {isProcessing && <div>Processing your voice...</div>}

      {transcription && (
        <div>
          <h3>Transcription:</h3>
          <p>{transcription}</p>
        </div>
      )}

      {translation && (
        <div>
          <h3>Translation (Korean):</h3>
          <p>{translation}</p>
        </div>
      )}
    </div>
  );
}
