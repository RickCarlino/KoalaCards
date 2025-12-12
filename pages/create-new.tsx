import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import {
  Button,
  Container,
  Group,
  SegmentedControl,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { getServersideUser } from "@/koala/get-serverside-user";
import { trpc } from "@/koala/trpc-config";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildCardPrompt,
  DEFAULT_DECK_NAME,
  KOREAN_LANG_CODE,
  LEVELS,
  type Level,
  PLACEHOLDERS,
  ROTATE_PLACEHOLDER_EVERY_MS,
} from "@/koala/create-first-deck/constants";

type CreateNewProps = Record<string, never>;

export const getServerSideProps: GetServerSideProps<
  CreateNewProps
> = async (ctx) => {
  const user = await getServersideUser(ctx);
  if (!user) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  return { props: {} };
};

function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}

function pickRandomIndex(maxExclusive: number) {
  if (maxExclusive <= 0) {
    return 0;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function resolveTopic(interest: string, fallback: string) {
  return interest.trim() || fallback;
}

function useRotatingTopic(params: {
  placeholders: readonly string[];
  intervalMs: number;
}) {
  const [topic, setTopic] = useState<string>("");
  const [placeholderIndex, setPlaceholderIndex] = useState<number>(0);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);

  const placeholder = params.placeholders[placeholderIndex] ?? "";

  const randomize = useCallback(() => {
    if (params.placeholders.length === 0) {
      return;
    }
    const nextIndex = pickRandomIndex(params.placeholders.length);
    setPlaceholderIndex(nextIndex);
    setTopic(params.placeholders[nextIndex] ?? "");
  }, [params.placeholders]);

  useEffect(() => {
    if (isFrozen) {
      return;
    }

    if (!topic) {
      randomize();
    }

    const id = setInterval(randomize, params.intervalMs);
    return () => clearInterval(id);
  }, [isFrozen, params.intervalMs, randomize, topic]);

  return {
    topic,
    setTopic,
    placeholder,
    freeze: () => setIsFrozen(true),
  };
}

export default function CreateNew() {
  const router = useRouter();
  const [level, setLevel] = useState<Level>("Beginner");
  const createDeck = trpc.createDeck.useMutation();
  const parseCards = trpc.parseCards.useMutation();
  const bulkCreate = trpc.bulkCreateCards.useMutation();
  const isWorking = useMemo(
    () =>
      [
        createDeck.isLoading,
        parseCards.isLoading,
        bulkCreate.isLoading,
      ].some(Boolean),
    [bulkCreate.isLoading, createDeck.isLoading, parseCards.isLoading],
  );

  const {
    topic,
    setTopic,
    placeholder: topicPlaceholder,
    freeze,
  } = useRotatingTopic({
    placeholders: PLACEHOLDERS,
    intervalMs: ROTATE_PLACEHOLDER_EVERY_MS,
  });

  const levelOptions = useMemo(
    () => LEVELS.map((level) => ({ label: level, value: level })),
    [],
  );

  const handleLevelChange = (value: string) => {
    if (isLevel(value)) {
      setLevel(value);
    }
  };

  const onGo = async () => {
    try {
      const deck = await createDeck.mutateAsync({
        name: DEFAULT_DECK_NAME,
        langCode: KOREAN_LANG_CODE,
      });

      const resolvedTopic = resolveTopic(topic, topicPlaceholder);
      const { cards } = await parseCards.mutateAsync({
        langCode: KOREAN_LANG_CODE,
        text: buildCardPrompt({ level, topic: resolvedTopic }),
      });

      if (cards.length === 0) {
        notifications.show({
          title: "No content",
          message:
            "Could not generate cards. Please tweak your topic and try again.",
          color: "red",
        });
        return;
      }
      await bulkCreate.mutateAsync({ deckId: deck.id, input: cards });

      await router.push(`/review/${deck.id}`);
    } catch {
      notifications.show({
        title: "Error",
        message: "Could not create your first deck. Please try again.",
        color: "red",
      });
    }
  };

  return (
    <Container size="sm" py="lg">
      <Title order={2} mb="xs">
        Create Your First Deck
      </Title>
      <Text c="dimmed" mb="lg">
        Deck name will be "{DEFAULT_DECK_NAME}".
      </Text>

      <Group align="center" wrap="wrap" gap="xs" mb="md">
        <Text>I am a</Text>
        <SegmentedControl
          value={level}
          onChange={handleLevelChange}
          data={levelOptions}
        />
        <Text>Make cards related to...</Text>
      </Group>

      <TextInput
        placeholder={`e.g., ${topicPlaceholder}`}
        value={topic}
        onFocus={freeze}
        onChange={(e) => setTopic(e.currentTarget.value)}
        mb="lg"
      />

      <Group justify="flex-start">
        <Button onClick={onGo} loading={isWorking}>
          Go!
        </Button>
      </Group>
    </Container>
  );
}
