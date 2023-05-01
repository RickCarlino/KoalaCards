import { useVoiceRecorder } from "@/hooks/use-recorder";
import { Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { playAudio } from "./play-button";

/**
 * Converts an MP4 audio Blob to a single-channel (mono) WAV audio Blob.
 * 
 * This function takes an MP4 audio Blob as input, decodes it, downmixes it to mono,
 * and converts it to a WAV audio Blob. This is useful when the target use case requires
 * single-channel audio, such as voice recordings or other mono audio data.
 * 
 * Example usage:
 * // Convert an MP4 audio Blob to a single-channel WAV audio Blob
 * const mp4Blob = new Blob([data], { type: "audio/mp4" });
 * const wavBlob = await convertBlobToWav(mp4Blob);
 *
 * // Use the resulting WAV Blob, e.g., for playback or upload
 * const audioURL = URL.createObjectURL(wavBlob);
 * const audioElement = new Audio(audioURL);
 * audioElement.play();
 */
async function convertBlobToWav(blob: Blob, targetSampleRate = 8000): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const numberOfChannels = 1; // Set to mono

  // Create an offline audio context to resample the audio
  const offlineAudioContext = new OfflineAudioContext(numberOfChannels, audioBuffer.duration * targetSampleRate, targetSampleRate);

  // Create a buffer source with the original audio
  const bufferSource = offlineAudioContext.createBufferSource();
  bufferSource.buffer = audioBuffer;

  // Connect the buffer source to the offline audio context
  bufferSource.connect(offlineAudioContext.destination);

  // Start the buffer source
  bufferSource.start(0);

  // Render the resampled audio
  const resampledBuffer = await offlineAudioContext.startRendering();
  const sampleRate = resampledBuffer.sampleRate;

  const wavBuffer = new ArrayBuffer(44 + resampledBuffer.length * 2);
  const view = new DataView(wavBuffer);

  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(view, 0, "RIFF");
  view.setUint32(4, 32 + resampledBuffer.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, resampledBuffer.length * 2, true);

  const length = resampledBuffer.length;
  const volume = 1;
  let index = 44;

  for (let i = 0; i < length; i++) {
    let mixedSample = 0;
    for (let channel = 0; channel < resampledBuffer.numberOfChannels; channel++) {
      mixedSample += resampledBuffer.getChannelData(channel)[i];
    }
    mixedSample /= resampledBuffer.numberOfChannels;
    view.setInt16(index, mixedSample * (0x7fff * volume), true);
    index += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
type Props = {
  onRecord: (data: string) => void;
  quizType: string;
};
export function RecordButton(props: Props) {
  const { isRecording, stop, start } = useVoiceRecorder(async (data) => {
    const wav = await convertBlobToWav(data);
    const b64 = await blobToBase64(wav);
    await playAudio(b64); // TODO: Maybe move to onRecord callback in parent.
    props.onRecord(b64);
  });
  useHotkeys([
    [
      "z",
      () => {
        (isRecording ? stop : start)();
      },
    ],
  ]);
  let buttonText = "Record";
  switch (props.quizType) {
    case "dictation":
      buttonText = "Say it in Korean";
      break;
    case "listening":
      buttonText = "Translate to English";
      break;
    case "speaking":
      buttonText = "Translate to Korean?";
      break;
  }
  return isRecording ? (
    <Button onClick={stop} color="red">
      ⏹️Submit Answer (Z)
    </Button>
  ) : (
    <Button onClick={start}>⏺️{buttonText} (Z)</Button>
  );
}
