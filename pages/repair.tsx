import { useState } from "react";
import { GetServerSideProps } from "next";
import {
  Button,
  Card,
  Title,
  Text,
  Stack,
  Image,
  rem,
  Center,
} from "@mantine/core";
import { trpc } from "@/koala/trpc-config";
import { blobToBase64 } from "@/koala/record-button";
import { compare } from "@/koala/quiz-evaluators/evaluator-utils";
import { playAudio } from "@/koala/play-audio";
import { useVoiceRecorder } from "@/koala/use-recorder";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";
import { LangCode } from "@/koala/shared-types";
import { getServersideUser } from "@/koala/get-serverside-user";
import { GetRepairOutputParams } from "@/koala/fetch-failure-types";

// Fetch data on the server:
type RepairPageProps = {
  cards: GetRepairOutputParams;
};

const ATTEMPTS = 2;

export const getServerSideProps: GetServerSideProps<
  RepairPageProps
> = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const { getRepairCards } = await import("@/koala/fetch-failures");
  const deckId = Number(context.query.deckId);

  return {
    props: {
      cards: await getRepairCards({
        userId: dbUser.id,
        deckId,
        take: 10,
      }),
    },
  };
};

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

// If you want a helper that plays both “term” and “definition” in sequence:
async function playTerm(card: GetRepairOutputParams[number]) {
  await playAudio(card.termAudio);
}

// Just for the VisualDiff
function Diff({ expected, actual }: { expected: string; actual: string }) {
  return <VisualDiff expected={expected} actual={actual} />;
}

function CardRepairFlow({
  card,
  onComplete,
}: {
  card: GetRepairOutputParams[number];
  onComplete: () => void;
}) {
  const [correctAttempts, setCorrectAttempts] = useState(0); // Changed to track total correct attempts
  const [lastAttemptWrong, setLastAttemptWrong] = useState<null | {
    expected: string;
    actual: string;
  }>(null);

  const repairCard = useCardRepair();
  const transcribeAudio = trpc.transcribeAudio.useMutation();

  // Our voice recorder callback:
  const voiceRecorder = useVoiceRecorder(async (audio: Blob) => {
    setLastAttemptWrong(null); // clear any old “wrong attempt” message

    // Transcribe:
    const { result } = await transcribeAudio.mutateAsync({
      audio: await blobToBase64(audio),
      lang: card.langCode as LangCode,
      targetText: card.term,
    });

    // Check correctness:
    const isCorrect = compare(result, card.term);
    if (isCorrect) {
      /**
       * 2) PLAY TERM + DEFINITION WHEN CORRECT
       */
      await playTerm(card);

      // Increment the correct attempts counter
      setCorrectAttempts((prev) => {
        const newCount = prev + 1;
        if (newCount === ATTEMPTS) {
          repairCard(card.cardId);
          playAudio(card.definitionAudio);
          onComplete();
          return 0;
        }
        return newCount;
      });
    } else {
      // Wrong attempt: Display the error message but don't reset the counter
      setLastAttemptWrong({ expected: card.term, actual: result });
    }
  });

  return (
    <Card
      shadow="sm"
      radius="md"
      withBorder
      padding="lg"
      style={{ maxWidth: rem(600) }}
    >
      <Stack gap="md">
        <Title order={2}>Repairing: {card.term}</Title>
        <Text size="sm" color="dimmed">
          {card.definition}
        </Text>

        {card.imageURL && (
          <Image
            src={card.imageURL}
            alt={card.term}
            width={rem(200)}
            radius="md"
          />
        )}

        <Stack gap="xs">
          <Text size="sm">
            You need <strong>{ATTEMPTS} correct</strong> attempts.
          </Text>
          <Text size="sm">
            Current count: <strong>{correctAttempts}</strong>/{ATTEMPTS}
          </Text>

          {lastAttemptWrong && (
            <Card withBorder shadow="xs" p="sm" radius="md">
              <Text color="red" fw="bold" style={{ marginBottom: rem(6) }}>
                That wasn't quite right:
              </Text>
              <Diff
                expected={lastAttemptWrong.expected}
                actual={lastAttemptWrong.actual}
              />
            </Card>
          )}
        </Stack>

        <Stack gap="xs" style={{ marginTop: rem(16) }}>
          <Button onClick={() => playAudio(card.termAudio)}>
            Play Term
          </Button>

          {!voiceRecorder.isRecording && (
            <Button color="blue" onClick={voiceRecorder.start}>
              Start Recording
            </Button>
          )}
          {voiceRecorder.isRecording && (
            <Button color="red" onClick={voiceRecorder.stop}>
              Stop Recording
            </Button>
          )}

          {voiceRecorder.error && (
            <Text color="red">Error: {voiceRecorder.error.message}</Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

/**
 * Main Repair Page:
 * - Renders one card at a time until “n consecutive correct” resets the card’s failure
 * - Then moves on to the next card
 */
export default function RepairPage({ cards }: RepairPageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!cards || cards.length === 0) {
    return (
      <Center style={{ minHeight: "100vh" }}>
        <Stack align="center" justify="center" p="xl">
          <Title order={3}>No cards need repair!</Title>
        </Stack>
      </Center>
    );
  }

  const currentCard = cards[currentIndex];

  // If all cards have been repaired:
  if (!currentCard) {
    return (
      <Center style={{ minHeight: "100vh" }}>
        <Stack align="center" justify="center" p="xl">
          <Title order={3}>Session Complete</Title>
          <Text size="md" color="dimmed">
            You repaired {cards.length} cards.
            <Button onClick={() => window.location.reload()}>
              Load More?
            </Button>
          </Text>
        </Stack>
      </Center>
    );
  }

  // Called when user finishes repair on the current card
  const handleComplete = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  return (
    <Center style={{ minHeight: "100vh" }}>
      <Stack gap="lg" p="xl" align="center" justify="center">
        <Title order={1}>Repair Mode</Title>
        <Text size="md" color="dimmed">
          Repeat each word/phrase <strong>{3} times correctly</strong> to
          repair.
        </Text>
        <CardRepairFlow card={currentCard} onComplete={handleComplete} />
      </Stack>
    </Center>
  );
}
