import { useVoiceRecorder } from "@/hooks/use-recorder";
import { Button } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { playAudio } from "./play-button";

// Thanks, GPT4.
async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioContext.sampleRate;

  const wavBuffer = new ArrayBuffer(44 + audioBuffer.length * 2);
  const view = new DataView(wavBuffer);

  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(view, 0, "RIFF");
  view.setUint32(4, 32 + audioBuffer.length * 2, true);
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
  view.setUint32(40, audioBuffer.length * 2, true);

  const length = audioBuffer.length;
  const volume = 1;
  let index = 44;

  for (let i = 0; i < length; i++) {
    view.setInt16(
      index,
      audioBuffer.getChannelData(0)[i] * (0x7fff * volume),
      true
    );
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
