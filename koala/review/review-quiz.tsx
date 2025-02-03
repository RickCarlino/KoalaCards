import { playAudio } from "@/koala/play-audio";
import { compare } from "@/koala/quiz-evaluators/evaluator-utils";
import { blobToBase64 } from "@/koala/record-button";
import { VisualDiff } from "@/koala/review/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Center, rem, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState } from "react";
import { HOTKEYS } from "./hotkeys"; // <-- Make sure you import your existing hotkeys
import { QuizComp } from "./types";
import { playFX } from "../play-fx";

const ATTEMPTS = 2;

function Diff({ expected, actual }: { expected: string; actual: string }) {
  return <VisualDiff expected={expected} actual={actual} />;
}

function useCardRepair() {
  const update = trpc.editCard.useMutation();
  return async function (id: number) {
    await update.mutateAsync({
      id,
      lastFailure: 0,
    });
  };
}

export const ReviewQuiz: QuizComp = ({ quiz, onComplete, onGraded }) => {
  const card = quiz.quiz;
  const repairCard = useCardRepair();
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const [correctAttempts, setCorrectAttempts] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [lastAttemptWrong, setLastAttemptWrong] = useState<null | {
    expected: string;
    actual: string;
  }>(null);
  useEffect(() => {
    playFX("/listening-beep.wav");
  }, [card.term]);
  const voiceRecorder = useVoiceRecorder(async (audio: Blob) => {
    setLastAttemptWrong(null); // clear any old “wrong attempt” message
    setIsThinking(true);
    const { result } = await transcribeAudio
      .mutateAsync({
        audio: await blobToBase64(audio),
        lang: card.langCode as LangCode,
        targetText: card.term,
      })
      .finally(() => setIsThinking(false));

    const isCorrect = compare(result, card.term);
    if (isCorrect) {
      await playAudio(card.termAudio);
      setCorrectAttempts((oldCount) => {
        const newCount = oldCount + 1;
        if (newCount === ATTEMPTS) {
          repairCard(quiz.quiz.cardId).then(() => {
            onGraded(Grade.EASY);
            onComplete({
              status: "pass",
              feedback: "Card re-reviewed",
              userResponse: result,
            });
          });
        }
        return newCount;
      });
    } else {
      setLastAttemptWrong({ expected: card.term, actual: result });
    }
  });

  useHotkeys([
    [
      HOTKEYS.RECORD,
      (e) => {
        e.preventDefault();
        voiceRecorder.isRecording
          ? voiceRecorder.stop()
          : voiceRecorder.start();
      },
    ],
    // Shift+P plays the term audio
    [HOTKEYS.PLAY, () => playAudio(card.termAudio)],
  ]);

  return (
    <Stack gap="md">
      <Center>
        <Text size="l">
          {isThinking ? "Grading Response..." : "Let's Try Again"}
        </Text>
      </Center>
      <Text fw={1000}>{card.term}</Text>
      <Text size="sm">{card.definition}</Text>
      <Stack gap="xs">
        <Text size="sm">
          {card.lapses > 9
            ? "This card has been unusually difficult for you. Perhaps you should pause reviews?"
            : "You previously had trouble with this card."}
          Repeat <strong>{ATTEMPTS} times</strong> to continue.
        </Text>
        <Text size="sm">
          Current count: <strong>{correctAttempts}</strong>/{ATTEMPTS}
        </Text>
        {lastAttemptWrong && (
          <Diff
            expected={lastAttemptWrong.expected}
            actual={lastAttemptWrong.actual}
          />
        )}
      </Stack>

      <Stack gap="xs" style={{ marginTop: rem(16) }}>
        <Button onClick={() => playAudio(card.termAudio)}>
          Play Audio Again
        </Button>
        <Button
          color={voiceRecorder.isRecording ? "red" : "blue"}
          onClick={() =>
            voiceRecorder.isRecording
              ? voiceRecorder.stop()
              : voiceRecorder.start()
          }
        >
          {voiceRecorder.isRecording ? "Stop Recording" : "Begin Recording"}
        </Button>
      </Stack>
    </Stack>
  );
};
