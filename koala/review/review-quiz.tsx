import { playAudio } from "@/koala/play-audio";
import { compare } from "@/koala/quiz-evaluators/evaluator-utils";
import { blobToBase64 } from "@/koala/record-button";
import { VisualDiff } from "@/koala/review/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Center, rem, Stack, Text } from "@mantine/core";
import { Grade } from "femto-fsrs";
import { useState } from "react";
import { QuizComp } from "./types";

const ATTEMPTS = 2;

function Diff({ expected, actual }: { expected: string; actual: string }) {
  return <VisualDiff expected={expected} actual={actual} />;
}
// Mutation to reset a card's last failure:
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
  const [correctAttempts, setCorrectAttempts] = useState(0); // Changed to track total correct attempts
  const [lastAttemptWrong, setLastAttemptWrong] = useState<null | {
    expected: string;
    actual: string;
  }>(null);
  const repairCard = useCardRepair();
  const transcribeAudio = trpc.transcribeAudio.useMutation();

  const voiceRecorder = useVoiceRecorder(async (audio: Blob) => {
    setLastAttemptWrong(null); // clear any old “wrong attempt” message

    const { result } = await transcribeAudio.mutateAsync({
      audio: await blobToBase64(audio),
      lang: card.langCode as LangCode,
      targetText: card.term,
    });

    const isCorrect = compare(result, card.term);
    if (isCorrect) {
      await playAudio(card.termAudio);
      const newCount = correctAttempts + 1;
      setCorrectAttempts(newCount);
      if (newCount === ATTEMPTS) {
        await repairCard(quiz.quiz.cardId);
        onGraded(Grade.EASY);
        onComplete({
          status: "pass",
          feedback: "Card re-reviewed",
          userResponse: result,
        });
      }
    } else {
      setLastAttemptWrong({ expected: card.term, actual: result });
    }
  });

  return (
    <Stack gap="md">
      <Center>
        <Text size="l">Let's Try Again</Text>
      </Center>
      <Text fw={1000}>{card.term}</Text>
      <Text size="sm">{card.definition}</Text>
      <Stack gap="xs">
        <Text size="sm">
          You previously had trouble with this card. Let's repeat this{" "}
          <strong>{ATTEMPTS} times</strong> to continue.
        </Text>
        <Text size="sm">
          Current count: <strong>{correctAttempts}</strong>/{ATTEMPTS}
        </Text>

        {lastAttemptWrong && (
          <>
            <Diff
              expected={lastAttemptWrong.expected}
              actual={lastAttemptWrong.actual}
            />
          </>
        )}
      </Stack>

      <Stack gap="xs" style={{ marginTop: rem(16) }}>
        <Button onClick={() => playAudio(card.termAudio)}>Play Term</Button>

        {!voiceRecorder.isRecording && (
          <Button color="blue" onClick={voiceRecorder.start}>
            Start Recording
          </Button>
        )}
        {voiceRecorder.isRecording && (
          <Button onClick={voiceRecorder.stop}>Stop Recording</Button>
        )}

        {voiceRecorder.error && (
          <Text>Error: {voiceRecorder.error.message}</Text>
        )}
      </Stack>
    </Stack>
  );
};
