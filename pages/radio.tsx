import { playAudio } from "@/koala/play-audio";
import { trpc } from "@/koala/trpc-config";
import { Container, Title, Card, Button, Group } from "@mantine/core";
import { useRef, useState } from "react";

export default function MediaPlayer() {
  const doGetRadioItem = trpc.getRadioItem.useMutation();
  const skipRef = useRef(0);
  const [skip, setSkip] = useState(0);

  const inc = () => {
    skipRef.current = skipRef.current + 1;
    setSkip(skipRef.current);
  };

  const reset = () => {
    skipRef.current = 0;
    setSkip(0);
  };

  async function doPlay() {
    const { audio } = await doGetRadioItem.mutateAsync({
      skip: skipRef.current,
    });
    if (audio) {
      inc();
      await playAudio(audio);
      await playAudio(audio);
      setTimeout(doPlay, 2500);
    } else {
      reset();
    }
  }

  return (
    <Container size="s">
      <Title order={1}>Media Player</Title>
      <Card shadow="xs" padding="md" radius="sm">
        Played {skip} items.
        <Group>
          <Button onClick={doPlay} color="green">
            Play
          </Button>
        </Group>
      </Card>
    </Container>
  );
}
