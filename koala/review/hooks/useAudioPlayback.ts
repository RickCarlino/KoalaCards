import { useEffect } from "react";
import { playAudio } from "@/koala/play-audio";

interface UseAudioPlaybackProps {
  termAudio?: string;
  autoPlay?: boolean;
}

export function useAudioPlayback({
  termAudio,
  autoPlay = false,
}: UseAudioPlaybackProps) {
  // Auto-play term audio on mount if enabled
  useEffect(() => {
    if (autoPlay && termAudio) {
      playAudio(termAudio);
    }
  }, [termAudio, autoPlay]);

  const playTermAudio = () => {
    if (termAudio) {
      playAudio(termAudio);
    }
  };

  const playSuccessSequence = async (definitionAudio?: string) => {
    if (definitionAudio) {
      await playAudio(definitionAudio);
    }
    if (termAudio) {
      await playAudio(termAudio);
    }
  };

  return {
    playTermAudio,
    playSuccessSequence,
  };
}
