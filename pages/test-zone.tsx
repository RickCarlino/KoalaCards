import { useState } from "react";
import { Button, Card, Center, Group, Stack, Text, Textarea } from "@mantine/core";
import { useMediaRecorder } from "@/koala/hooks/use-media-recorder";

async function sendAudio(blob: Blob): Promise<string> {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }
  const json: { text?: string } = await res.json();
  return json.text ?? "";
}

export default function TestZone() {
  const { start, stop, isRecording, mimeType } = useMediaRecorder();
  const [transcript, setTranscript] = useState<string>("");
  const [pending, setPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setTranscript("");
    if (!isRecording) {
      await start();
      return;
    }
    setPending(true);
    const blob = await stop();
    try {
      const text = await sendAudio(blob);
      setTranscript(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Center style={{ width: "100%", padding: "2rem" }}>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        style={{ width: "min(800px, 90%)" }}
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Audio Transcription (PoC)</Text>
            <Text c="dimmed" size="sm">
              {mimeType ? `MIME: ${mimeType}` : ""}
            </Text>
          </Group>
          <Button onClick={onClick} loading={pending} color={isRecording ? "red" : undefined} size="lg" fullWidth>
            {isRecording ? "Stop & Transcribe" : "Start Recording"}
          </Button>
          {error ? (
            <Text c="red">{error}</Text>
          ) : (
            <Textarea
              label="Transcript"
              placeholder="Press Start, then speak; Stop to transcribe"
              autosize
              minRows={3}
              value={transcript}
              readOnly
            />
          )}
          <Text c="dimmed" size="xs">
            Tip: On iOS Safari, recording must start from a user tap.
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}
