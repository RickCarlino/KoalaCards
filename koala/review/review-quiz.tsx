import { playAudio } from "@/koala/play-audio";
import { compare, removeParens } from "@/koala/quiz-evaluators/evaluator-utils";
import { blobToBase64, convertBlobToWav } from "@/koala/record-button";
import { VisualDiff } from "@/koala/review/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { Button, Stack, Text, Box, Title } from "@mantine/core";
import { textShadowStyle } from "../styles";
import { useHotkeys } from "@mantine/hooks";
import { Grade } from "femto-fsrs";
import { useEffect, useState } from "react";
import { HOTKEYS } from "./hotkeys";
import { QuizComp } from "./types";
import { playFX } from "../play-fx";

export const ReviewQuiz: QuizComp = ({ quiz, onComplete, onGraded }) => {
  const card = quiz.quiz;
  const repairCard = trpc.editCard.useMutation();
  const transcribeAudio = trpc.transcribeAudio.useMutation();
  const [lastAttemptWrong, setLastAttemptWrong] = useState<null | {
    expected: string;
    actual: string;
  }>(null);

  useEffect(() => {
    playFX("/listening-beep.wav");
  }, [card.term]);

  const voiceRecorder = useVoiceRecorder(async (audio: Blob) => {
    setLastAttemptWrong(null);

    const wavBlob = await convertBlobToWav(audio);
    const base64Audio = await blobToBase64(wavBlob);

    const { result } = await transcribeAudio.mutateAsync({
      audio: base64Audio,
      lang: card.langCode as LangCode,
      targetText: card.term,
    });

    const isCorrect = compare(result, removeParens(card.term));
    if (isCorrect) {
      await playAudio(card.termAudio);
      await repairCard.mutateAsync({ id: quiz.quiz.cardId, lastFailure: 0 });
      onGraded(Grade.EASY);
      onComplete({
        status: "pass",
        feedback: "Card re-reviewed",
        userResponse: result,
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
    [HOTKEYS.PLAY, () => playAudio(card.termAudio)],
  ]);

  return (
    <Stack gap="md">
      <Title order={2} ta="center" size="h3" style={textShadowStyle}>
        Review Difficult Card
      </Title>
      <Text size="lg" fw={700}>
        {card.term}
      </Text>
      <Text size="md">{card.definition}</Text>
      <Box my="md">
        <Stack gap="sm">
          <Text size="md" fw={500}>
            {lastAttemptWrong ? (
              <VisualDiff
                expected={lastAttemptWrong.expected}
                actual={lastAttemptWrong.actual}
              />
            ) : (
              "Please repeat the phrase to continue."
            )}
          </Text>
        </Stack>
      </Box>

      <Stack gap="md" mt="md">
        <Button
          onClick={() => playAudio(card.termAudio)}
          fullWidth
          size="md"
          color="pink"
        >
          Play Audio Again
        </Button>
        <Button
          color={voiceRecorder.isRecording ? "red" : "pink"}
          onClick={() =>
            voiceRecorder.isRecording
              ? voiceRecorder.stop()
              : voiceRecorder.start()
          }
          fullWidth
          size="lg"
          h={50}
        >
          {voiceRecorder.isRecording ? "Stop Recording" : "Begin Recording"}
        </Button>
      </Stack>
    </Stack>
  );
};
