import { GetServerSideProps } from "next";
import React from "react";
import { useRouter } from "next/router";
import {
  Button,
  Container,
  Group,
  SegmentedControl,
  Select,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { getServersideUser } from "@/koala/get-serverside-user";
import { LangCode, supportedLanguages } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";

type CreateNewProps = {
  defaultLang: LangCode;
};

export const getServerSideProps: GetServerSideProps<
  CreateNewProps
> = async (ctx) => {
  const user = await getServersideUser(ctx);
  if (!user) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const defaultLang: LangCode = "ko";

  return { props: { defaultLang } };
};

type Level = "Beginner" | "Intermediate" | "Advanced";

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

function generateCardPrompt({
  level,
  langName,
  topic,
}: {
  level: Level;
  langName: LangCode;
  topic: string;
}) {
  const lang = supportedLanguages[langName] || langName;
  return [
    `You are a ${lang} language teacher that helps students learn by creating short example sentence flashcards.`,
    `the perfect example sentence is only a few syllables long.`,
    `the perfect example sentence uses common words and grammar suitable for a ${level.toLowerCase()} learner.`,
    `the learner said they are interested ${topic}.`,
    `Create 15 example sentences with English translations (do NOT include romanizations or pronunciations).`,
    `Use language that reflects how ${lang} speakers actually talk in real life.`,
    `Do NOT come up with low quality english sentence and lazily translate them to the target language.`,
    `Authenticity is very important! Both in terms of the language used and the cultural context.`,
    `Use a variety of sentence structures and vocabulary.`,
  ].join("\n");
}

export default function CreateNew({ defaultLang }: CreateNewProps) {
  const router = useRouter();
  const [level, setLevel] = React.useState<Level>("Beginner");
  const [lang, setLang] = React.useState<LangCode>(defaultLang);
  const [interest, setInterest] = React.useState<string>("");
  const [placeholderIndex, setPlaceholderIndex] =
    React.useState<number>(0);
  const [hasFocused, setHasFocused] = React.useState<boolean>(false);
  const createDeck = trpc.createDeck.useMutation();
  const parseCards = trpc.parseCards.useMutation();
  const bulkCreate = trpc.bulkCreateCards.useMutation();

  React.useEffect(() => {
    const randomize = () => {
      const next = Math.floor(Math.random() * PLACEHOLDERS.length);
      setPlaceholderIndex(next);
      setInterest(PLACEHOLDERS[next]);
    };

    if (hasFocused) {
      return;
    }

    if (!interest) {
      randomize();
    }

    const id = setInterval(() => {
      if (!hasFocused) {
        randomize();
      }
    }, 700);

    return () => clearInterval(id);
  }, [hasFocused, interest]);

  const onGo = async () => {
    try {
      const deck = await createDeck.mutateAsync({
        name: "My First Koala Deck",
        langCode: lang,
      });

      const topic = interest.trim() || PLACEHOLDERS[placeholderIndex];
      const { cards } = await parseCards.mutateAsync({
        langCode: lang,
        text: generateCardPrompt({
          level,
          langName: lang,
          topic,
        }),
      });

      const input = cards.map((c) => ({
        ...c,
        gender: (c.gender ?? "N") as "M" | "F" | "N",
      }));
      if (input.length === 0) {
        notifications.show({
          title: "No content",
          message:
            "Could not generate cards. Please tweak your topic and try again.",
          color: "red",
        });
        return;
      }
      await bulkCreate.mutateAsync({ deckId: deck.id, input });

      await router.push(`/review/${deck.id}`);
    } catch (e) {
      console.error(e);
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
        Deck name will be "My First Koala Deck".
      </Text>

      <Group align="center" wrap="wrap" gap="xs" mb="md">
        <Text>I am a</Text>
        <SegmentedControl
          value={level}
          onChange={(v) => setLevel(v as Level)}
          data={["Beginner", "Intermediate", "Advanced"].map((l) => ({
            label: l,
            value: l,
          }))}
        />
        <Select
          value={lang}
          onChange={(v) => setLang((v as LangCode) || lang)}
          data={Object.entries(supportedLanguages).map(([code, name]) => ({
            value: code,
            label: name,
          }))}
          searchable
          style={{ minWidth: 220 }}
        />
        <Text>Make cards related to...</Text>
      </Group>

      <TextInput
        placeholder={`e.g., ${PLACEHOLDERS[placeholderIndex]}`}
        value={interest}
        onFocus={() => setHasFocused(true)}
        onChange={(e) => setInterest(e.currentTarget.value)}
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
