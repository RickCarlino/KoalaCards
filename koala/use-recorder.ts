import { useReducer, useRef } from "react";

type ReturnedSig = {
  recorder: MediaRecorder | null; // unused; kept for compatibility
  start: () => Promise<void>;
  stop: () => void;
  isRecording: boolean;
  error: unknown;
};

type State = {
  isRecording: boolean;
  stream: MediaStream | null;
  ctx: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  processor: ScriptProcessorNode | null;
  error: unknown;
};

type Actions =
  | { type: "start" }
  | {
      type: "startRecording";
      payload: {
        stream: MediaStream;
        ctx: AudioContext;
        source: MediaStreamAudioSourceNode;
        processor: ScriptProcessorNode;
      };
    }
  | { type: "stop" }
  | { type: "hasError"; payload: { error: unknown } };

const initState: State = {
  isRecording: false,
  stream: null,
  ctx: null,
  source: null,
  processor: null,
  error: null,
};

const reducer = (state: State, action: Actions): State => {
  switch (action.type) {
    case "start":
      return { ...state, isRecording: true };
    case "stop":
      return { ...state, isRecording: false };
    case "startRecording":
      return {
        ...state,
        isRecording: true,
        stream: action.payload.stream,
        ctx: action.payload.ctx,
        source: action.payload.source,
        processor: action.payload.processor,
      };
    case "hasError":
      return { ...state, isRecording: false, error: action.payload.error };
    default:
      return state;
  }
};

export const useVoiceRecorder = (
  cb: (result: Blob) => void,
): ReturnedSig => {
  const [state, dispatch] = useReducer(reducer, initState);

  // Accumulation buffers
  const pcmBuffers = useRef<Float32Array[]>([]);
  const totalSamples = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = async () => {
    if (state.isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        } as MediaTrackConstraints,
      });
      const Ctx: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended") {
        await ctx.resume().catch((err: unknown) => {
          console.error("[recorder] AudioContext.resume failed", err);
        });
      }
      const source = ctx.createMediaStreamSource(stream);
      const processor =
        (ctx as any).createScriptProcessor?.(4096, 1, 1) ||
        (ctx as any).createScriptProcessor?.(2048, 1, 1);
      if (!processor) throw new Error("Audio processor unavailable");

      pcmBuffers.current = [];
      totalSamples.current = 0;
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const input = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        pcmBuffers.current.push(copy);
        totalSamples.current += copy.length;
      };
      source.connect(processor);
      processor.connect(ctx.destination);

      dispatch({
        type: "startRecording",
        payload: { stream, ctx, source, processor },
      });
      dispatch({ type: "start" });

      // Auto-stop after 20s
      timeoutRef.current = setTimeout(() => stop(), 20000);
      // Clear previous error
      if (state.error)
        dispatch({ type: "hasError", payload: { error: null } });
    } catch (error: unknown) {
      dispatch({ type: "hasError", payload: { error } });
    }
  };

  const stop = () => {
    if (!state.isRecording) return;
    dispatch({ type: "stop" });
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    state.processor?.disconnect();
    state.source?.disconnect();

    state.stream?.getTracks().forEach((t) => t.stop());

    state.ctx?.close().catch((err: unknown) => {
      console.error("[recorder] AudioContext.close failed", err);
    });

    const sampleRate = state.ctx?.sampleRate ?? 44100;
    const wav = buildWavFromPcm(
      pcmBuffers.current,
      totalSamples.current,
      sampleRate,
    );
    // reset
    pcmBuffers.current = [];
    totalSamples.current = 0;
    cb(wav);
  };

  return {
    start,
    stop,
    recorder: null,
    isRecording: state.isRecording,
    error: state.error,
  };
};

function buildWavFromPcm(
  chunks: Float32Array[],
  totalSamples: number,
  sampleRate: number,
): Blob {
  const pcm = new Float32Array(totalSamples);
  let offset = 0;
  for (const chunk of chunks) {
    pcm.set(chunk, offset);
    offset += chunk.length;
  }
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, pcm.length * 2, true);

  let pos = 44;
  for (let i = 0; i < pcm.length; i++, pos += 2) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++)
    view.setUint8(offset + i, str.charCodeAt(i));
}
