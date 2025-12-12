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
import { LangCode, supportedLanguages } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import { useCallback, useEffect, useMemo, useState } from "react";

type CreateNewProps = Record<string, never>;
const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
type Level = (typeof LEVELS)[number];

const KOREAN_LANG_CODE: LangCode = "ko";
const KOREAN_LANGUAGE_NAME =
  supportedLanguages[KOREAN_LANG_CODE] || "Korean";
const DEFAULT_DECK_NAME = "My First Koala Deck";
const ROTATE_PLACEHOLDER_EVERY_MS = 700;

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

const PLACEHOLDERS = [
  "greetings and introductions",
  "numbers and counting",
  "telling the time",
  "days, months, seasons",
  "weather talk",
  "colors and shapes",
  "clothing and fashion",
  "directions and locations",
  "asking for help",
  "emergencies and safety",

  "airport check-in",
  "customs and immigration",
  "hotel check-in/out",
  "ordering taxis and rides",
  "public transport tickets",
  "navigating maps",
  "sightseeing and tours",
  "cultural etiquette",
  "asking for recommendations",
  "handling lost items",

  "restaurant conversations",
  "ordering drinks",
  "street food and markets",
  "dietary restrictions",
  "allergies and ingredients",
  "paying the bill",
  "making reservations",
  "coffee shop chats",
  "bar conversations",
  "cooking and recipes",

  "shopping and prices",
  "bargaining at markets",
  "paying for stuff",
  "credit cards and ATMs",
  "banking basics",
  "subscriptions and bills",
  "electronics shopping",
  "grocery shopping",
  "buying gifts",
  "returns and exchanges",

  "job interview practice",
  "office small talk",
  "meetings and presentations",
  "emails and phone calls",
  "introducing coworkers",
  "discussing projects",
  "student life",
  "classroom interactions",
  "giving a speech",
  "research and study habits",

  "daily routines",
  "household chores",
  "health and exercise",
  "doctor visits",
  "pharmacy and medicine",
  "sports and hobbies",
  "weekend plans",
  "appointments",
  "using technology",
  "social media",

  "family and friends",
  "dating and romance",
  "weddings and celebrations",
  "neighbors and community",
  "talking about feelings",
  "resolving conflicts",
  "parenting and children",
  "pets and animals",
  "birthdays",
  "holidays and traditions",

  "current events",
  "politics and government",
  "environment and nature",
  "science and technology",
  "art and literature",
  "music and entertainment",
  "religion and philosophy",
  "economics and business",
  "history and culture",
  "dreams and future plans",
];

function buildCardPrompt(params: { level: Level; topic: string }) {
  return [
    `You are a ${KOREAN_LANGUAGE_NAME} language teacher that helps students learn by creating short example sentence flashcards.`,
    `the perfect example sentence is only a few syllables long.`,
    `the perfect example sentence uses common words and grammar suitable for a ${params.level.toLowerCase()} learner.`,
    `the learner said they are interested ${params.topic}.`,
    `Create 15 example sentences with English translations (do NOT include romanizations or pronunciations).`,
    `Use language that reflects how ${KOREAN_LANGUAGE_NAME} speakers actually talk in real life.`,
    `Do NOT come up with low quality english sentence and lazily translate them to the target language.`,
    `Authenticity is very important! Both in terms of the language used and the cultural context.`,
    `Use a variety of sentence structures and vocabulary.`,
  ].join("\n");
}

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
  const trimmed = interest.trim();
  return trimmed ? trimmed : fallback;
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
        <Button
          onClick={onGo}
          loading={
            createDeck.isLoading ||
            parseCards.isLoading ||
            bulkCreate.isLoading
          }
        >
          Go!
        </Button>
      </Group>
    </Container>
  );
}
