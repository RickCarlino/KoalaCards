import { getLangName } from "@/koala/get-lang-name";
import { LangCode, supportedLanguages } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import {
  Button,
  Group,
  List,
  Progress,
  Radio,
  Select,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useRouter } from "next/router";
import React, { useCallback, useState } from "react";
import { GetServerSideProps } from "next";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";

interface Card {
  term: string;
  definition: string;
  gender: "M" | "F" | "N";
}

interface WizardStep {
  content: React.ReactNode;
}

interface StartPageProps {
  userSettings: {
    id: number;
    playbackSpeed: number;
    playbackPercentage: number;
    cardsPerDayMax: number;
    updatedAt: string;
  };
}

const initialForm = {
  language: "",
  cardsPerWeek: "",
  name: "",
  progress: "",
  interests: "",
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  // Fetch user settings
  const userSettings = await prismaClient.userSettings.findUnique({
    where: {
      userId: dbUser.id,
    },
    select: {
      id: true,
      playbackSpeed: true,
      playbackPercentage: true,
      cardsPerDayMax: true,
      updatedAt: true,
    },
  });

  if (!userSettings) {
    return {
      redirect: {
        destination: "/api/auth/signin",
        permanent: false,
      },
    };
  }

  return {
    props: {
      userSettings: {
        ...userSettings,
        updatedAt: userSettings.updatedAt.toISOString(),
      },
    },
  };
};

const StartPage: React.FC<StartPageProps> = ({ userSettings }) => {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [createdCards, setCreatedCards] = useState<Card[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  const editSettings = trpc.editUserSettings.useMutation();
  const parseCards = trpc.parseCards.useMutation();
  const bulkCreateCards = trpc.bulkCreateCards.useMutation();

  const updateField = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async () => {
    try {
      const { language, progress, interests } = form;
      const prompt = `
      We are onboarding a new user to a language learning flashcard app.
      They are learning ${getLangName(language)}.
      Please create a set of 25 cards for the user.
      The cards should contain very short sentences and phrases that are relevant to the user's interests and skill level.
      Focus on conversational language and practical vocabulary.
      Here's what they said regarding their interest and skill level:
      === PROGRESS: ${progress}
      === INTERESTS: ${interests}`;

      const result = await parseCards.mutateAsync({
        langCode: language as LangCode,
        text: prompt,
      });

      setCreatedCards(result.cards);
    } catch (error) {
      console.error("Error generating cards:", error);
      alert("Failed to generate cards. Please try again.");
    }
  };

  const handleTryAgain = () => {
    // Only reset the created cards and go back to the submission step
    // Don't reset all form data to avoid making the user fill everything again
    setCreatedCards([]);
  };

  const handleSave = async () => {
    try {
      // Set cards per day max based on ONBOARDING.md requirements
      let cardsPerDayMax = 7; // Default to 7 (casual)

      if (form.cardsPerWeek === "14") {
        cardsPerDayMax = 14; // Serious learner
      } else if (form.cardsPerWeek === "21") {
        cardsPerDayMax = 21; // Fulltime learner
      }

      // Update user settings
      await editSettings.mutateAsync({
        id: userSettings.id,
        cardsPerDayMax: cardsPerDayMax,
        playbackSpeed: userSettings.playbackSpeed,
        playbackPercentage: userSettings.playbackPercentage,
        writingFirst: false,
        updatedAt: new Date(userSettings.updatedAt),
      });

      // Create a new deck with the created cards
      const deckName = `${form.name}'s ${getLangName(form.language)} deck`;
      await bulkCreateCards.mutateAsync({
        langCode: form.language as LangCode,
        deckName: deckName,
        input: createdCards,
      });

      router.push("/review");
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save cards. Please try again.");
    }
  };

  const wizardSteps: WizardStep[] = [
    {
      content: (
        <div>
          <h2>Let's Learn About Your Needs</h2>
          <p>
            We are going to ask you a few questions to create your first set of
            cards. This will help us understand your learning style and
            preferences.
          </p>
          <p>
            We will create your first deck using the information you provide, so
            please be sure to answer the questions adequately.
          </p>
        </div>
      ),
    },
    {
      content: (
        <TextInput
          label="What's your name?"
          placeholder="Enter your name"
          value={form.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            updateField("name", e.target.value)
          }
        />
      ),
    },
    {
      content: (
        <Select
          label="What language are you learning?"
          placeholder="Pick one"
          data={Object.entries(supportedLanguages).map(([value, label]) => ({
            value,
            label,
          }))}
          searchable
          value={form.language}
          onChange={(val: string | null) => updateField("language", val || "")}
        />
      ),
    },
    {
      content: (
        <Radio.Group
          label="What's a good learning pace?"
          value={form.cardsPerWeek}
          onChange={(val: string) => updateField("cardsPerWeek", val)}
        >
          <Radio value="7" label="Casual learner (7 cards / day)" />
          <Radio value="14" label="Serious learner (14 cards / day)" />
          <Radio value="21" label="Fulltime (21 cards / day)" />
        </Radio.Group>
      ),
    },
    {
      content: (
        <Textarea
          label={`Help us pick appropriate content by describing your current skill level in ${getLangName(
            form.language,
          )}. It is important that you answer this question with as much detail as possible.`}
          placeholder="Current skill level"
          value={form.progress}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            updateField("progress", e.target.value)
          }
        />
      ),
    },
    {
      content: (
        <Textarea
          label="What are your interests? What topics do you enjoy? Why are you learning this language?"
          placeholder="Why you're learning"
          value={form.interests}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            updateField("interests", e.target.value)
          }
        />
      ),
    },
    {
      content: (
        <>
          <Button
            fullWidth
            onClick={handleSubmit}
            disabled={
              !!createdCards.length ||
              !form.language ||
              !form.progress ||
              !form.interests
            }
            loading={parseCards.isLoading}
          >
            Generate Cards
          </Button>
          {createdCards.length > 0 && (
            <>
              <h3>Your generated cards:</h3>
              <Group mt="md">
                <Button variant="outline" onClick={handleTryAgain}>
                  Try Again
                </Button>
                <Button
                  onClick={handleSave}
                  loading={bulkCreateCards.isLoading || editSettings.isLoading}
                >
                  Save & Continue
                </Button>
              </Group>
              <List spacing="xs" mt="md">
                {createdCards.map((c, i) => (
                  <List.Item key={i}>
                    <strong>{c.term}</strong>: {c.definition}
                  </List.Item>
                ))}
              </List>
            </>
          )}
        </>
      ),
    },
  ];

  return (
    <div>
      <h1>Welcome!</h1>
      <Progress
        value={(activeStep / (wizardSteps.length - 1)) * 100}
        size="md"
        radius="xl"
        mt="md"
        mb="md"
      />
      <div>{wizardSteps[activeStep].content}</div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 20,
        }}
      >
        <Button
          disabled={activeStep === 0}
          onClick={() => setActiveStep((s) => s - 1)}
        >
          Back
        </Button>
        <Button
          disabled={activeStep === wizardSteps.length - 1}
          onClick={() => setActiveStep((s) => s + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default StartPage;
