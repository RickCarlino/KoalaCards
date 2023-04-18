import { trpc } from "@/utils/trpc";
import { Button } from "@mantine/core";

type Phrase = NonNullable<
  ReturnType<typeof trpc.getNextPhrase.useMutation>["data"]
>;

/** A React component  */
export function PlayButton({ phrase }: { phrase: Phrase }) {
  const speak = trpc.speak.useMutation();
  const play = () => {
    type Speech = Parameters<typeof speak["mutateAsync"]>[0]["text"];
    let text: Speech = [
      { kind: "ko", value: phrase?.ko ?? "" },
      { kind: "pause", value: 500 },
      { kind: "en", value: phrase?.en ?? "" },
    ];
    switch (phrase.quizType) {
      case "dictation":
        text = [
          { kind: "en", value: "Repeat after me: " },
          { kind: "pause", value: 250 },
          { kind: "ko", value: phrase.ko },
          { kind: "pause", value: 250 },
          { kind: "slow", value: phrase.ko },
        ];
        break;
      case "listening":
        text = [
          { kind: "en", value: "Say this in English: " },
          { kind: "pause", value: 250 },
          { kind: "ko", value: phrase.ko },
        ];
        break;
      case "speaking":
        text = [
          { kind: "en", value: "Say this in Korean: " },
          { kind: "pause", value: 250 },
          { kind: "en", value: phrase.en },
        ];
        break;
    }
    speak.mutateAsync({
      text,
    });
  };
  return <Button onClick={play}>▶️Play</Button>;
}
