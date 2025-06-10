import { useEffect, useRef } from "react";
import { Recording } from "../types";

interface UseRecordingProcessorProps {
  recordings: Record<string, Recording>;
  currentStepUuid: string;
  onAudioReceived: (base64Audio: string) => void;
}

export function useRecordingProcessor({
  recordings,
  currentStepUuid,
  onAudioReceived,
}: UseRecordingProcessorProps) {
  const audio = recordings?.[currentStepUuid]?.audio;
  const update = () => {
    audio && onAudioReceived(audio);
  };
  useEffect(update, [audio, currentStepUuid]);
}
