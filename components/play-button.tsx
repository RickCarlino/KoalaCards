import { trpc } from "@/utils/trpc";
import { Button } from "@mantine/core";

type Phrase = {
  ko: string;
  en: string;
};

/** A React component  */
export function PlayButton({ phrase }: { phrase: Phrase }) {
  const speak = trpc.speak.useMutation();
  const play = () => {
    speak
      .mutateAsync({
        text: [
          { kind: "ko", value: phrase?.ko ?? "" },
          { kind: "pause", value: 500 },
          { kind: "en", value: phrase?.en ?? "" },
        ],
      })
      .then((res) => {
        console.log(res);
      });
  };
  return <Button onClick={play}>▶️Play</Button>;
}
