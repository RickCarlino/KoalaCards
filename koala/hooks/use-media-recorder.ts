import { useEffect, useMemo, useRef, useState } from "react";
import { playBeep } from "@/koala/utils/play-beep";

export type RecorderControls = {
  start: (startOptions?: { playBeep?: boolean }) => Promise<void>;
  stop: () => Promise<Blob>;
  isRecording: boolean;
  mimeType: string | null;
};

export function useMediaRecorder(): RecorderControls {
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const beepArmedRef = useRef<boolean>(false);

  const preferredMime = useMemo(() => {
    const webm = "audio/webm;codecs=opus";
    const mp4 = "audio/mp4";
    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined"
    ) {
      return null;
    }
    if (MediaRecorder.isTypeSupported(webm)) {
      return webm;
    }
    if (MediaRecorder.isTypeSupported(mp4)) {
      return mp4;
    }
    return "";
  }, []);

  useEffect(() => {
    return () => {
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  }, [recorder]);

  async function start(startOptions?: {
    playBeep?: boolean;
  }): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    const options: MediaRecorderOptions = {};
    if (preferredMime) {
      options.mimeType = preferredMime;
    }
    options.audioBitsPerSecond = 16_000;

    const rec = new MediaRecorder(stream, options);
    setMimeType(rec.mimeType);
    chunksRef.current = [];
    // Arm the beep; fire on first actual audio data or track unmute.
    const shouldBeep = startOptions?.playBeep !== false;
    beepArmedRef.current = shouldBeep;

    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
        if (beepArmedRef.current) {
          beepArmedRef.current = false;
          void playBeep();
        }
      }
    };

    // Use a shorter timeslice so iOS/WebKit emits chunks promptly
    rec.start(250);
    setRecorder(rec);
    setIsRecording(true);
  }

  function stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const current = recorder;
      if (!current) {
        return resolve(new Blob());
      }
      // Disarm pending beep
      beepArmedRef.current = false;
      current.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: current.mimeType,
        });
        chunksRef.current = [];
        current.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolve(blob);
      };
      // Request any buffered data before stopping (helps on some iOS versions)
      if (typeof current.requestData === "function") {
        current.requestData();
      }
      current.stop();
    });
  }

  return { start, stop, isRecording, mimeType };
}
