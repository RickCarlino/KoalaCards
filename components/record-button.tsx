import { useVoiceRecorder } from "@/hooks/use-recorder";
import { Button } from "@mantine/core";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export function RecordButton(props: { onRecord: (data: string) => void }) {

  const { isRecording, stop, start } = useVoiceRecorder(async (data) => {
    props.onRecord(await blobToBase64(data));
  });

  return isRecording ? (
    <Button onClick={stop}>⏹️Stop</Button>
  ) : (
    <Button onClick={start}>⏺️Record</Button>
  );
}
