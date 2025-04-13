import { useState } from "react";
import { trpc } from "@/koala/trpc-config";
// Removed unused useRouter
import { notifications } from "@mantine/notifications";
import { GetServerSideProps } from "next";
import { getServersideUser } from "@/koala/get-serverside-user";
import { LangCode } from "@/koala/shared-types"; // Removed unused LANG_CODES
import { getLangName } from "@/koala/get-lang-name"; // Import the helper
import { VisualDiff } from "@/koala/review/visual-diff";
import {
  Container,
  Title,
  Textarea,
  Button,
  Paper,
  Text,
  Divider,
  Group,
  Box,
  Alert,
  Loader,
  Card,
  Stack,
  rem,
  useMantineTheme,
  ThemeIcon,
} from "@mantine/core";
import {
  IconCheck,
  IconX,
  IconBulb,
  IconPencil,
  IconArrowRight,
  IconSparkles,
  IconWand, // Added for generate prompts button
} from "@tabler/icons-react";

import type { EssayResponse } from "@/koala/trpc-routes/grade-writing";
import { prismaClient } from "@/koala/prisma-client";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const codes = await prismaClient.card.findMany({
    select: {
      langCode: true,
    },
    distinct: ["langCode"],
    where: {
      userId: dbUser.id,
    },
  });
  return {
    props: {
      langCodes: codes.map((c) => c.langCode),
    },
  };
};

interface WritingAssistantProps {
  langCodes: LangCode[];
}

const WritingAssistant = ({ langCodes }: WritingAssistantProps) => {
  const [essay, setEssay] = useState("");
  const [feedback, setFeedback] = useState<EssayResponse | null>(null);
  const [loading, setLoading] = useState(false); // For analyzing
  const [prompts, setPrompts] = useState<string[]>([]);
  const [promptsLoading, setPromptsLoading] = useState<LangCode | null>(null); // Track which lang is loading
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const [selectedLangCode, setSelectedLangCode] = useState<LangCode | null>(
     langCodes?.length === 1 ? langCodes[0] : null // Default if only one lang
  );
  const theme = useMantineTheme();
  const primaryColor = theme.primaryColor || "blue";

  // Use the tRPC mutations
  const gradeWritingMutation = trpc.gradeWriting.useMutation({
    onError: (error) => {
      notifications.show({
        title: "Error",
        message:
          error.message || "Failed to analyze your writing. Please try again.",
        color: "red",
      });
      setLoading(false); // Ensure loading state is reset on error
    },
  });

  // tRPC mutation for generating prompts
  const generatePromptsMutation = trpc.generateWritingPrompts.useMutation({
    // Use opts to get access to the variables passed to mutate
    onSuccess: (data, variables) => {
      setPrompts(data);
      setPromptsError(null);
      setSelectedLangCode(variables.langCode); // Set selected lang on success
      notifications.show({
        title: "Prompts Generated",
        message: "New writing prompts are ready!",
        color: "green",
      });
    },
    onError: (error) => {
      setPromptsError(error.message || "Failed to generate prompts.");
      notifications.show({
        title: "Error Generating Prompts",
        message: error.message || "Please try again.", // Removed duplicate message property
        color: "red",
      });
    },
    onSettled: () => {
      setPromptsLoading(null); // Clear loading state regardless of success/error
    },
  });

  const handleAnalyze = async () => {
    if (!essay.trim()) return;

    if (!selectedLangCode) {
       notifications.show({
        title: "Language Not Selected",
        message: "Please generate prompts for a language first to set the context for analysis.",
        color: "orange",
      });
      return;
    }

    setLoading(true);
    setFeedback(null); // Clear previous feedback
    try {
      const result = await gradeWritingMutation.mutateAsync({
        text: essay,
        langCode: selectedLangCode, // Use the selected language
      });
      setFeedback(result);
    } catch (error) {
      // Error is handled by the mutation's onError, which also sets loading to false
    } finally {
       setLoading(false); // Ensure loading is stopped even if mutateAsync doesn't throw
    }
  };

  // Updated to accept the specific language code
  const handleGeneratePrompts = (code: LangCode) => {
    setPromptsLoading(code); // Set loading state for this specific language
    setPromptsError(null); // Clear previous errors
    setPrompts([]); // Clear previous prompts
    generatePromptsMutation.mutate({ langCode: code });
  };

  const renderFeedback = () => {
    if (!feedback) return null;

    // Join all original sentences into a single paragraph
    const originalText = feedback.sentences.map((s) => s.input).join(" ");

    // Join all corrected sentences into a single paragraph
    const correctedText = feedback.sentences
      .map((s) => (s.ok ? s.input : s.correction))
      .join(" ");

    // Collect all explanations from sentences that have corrections
    const allExplanations = feedback.sentences
      .filter((s) => !s.ok)
      .flatMap((s) => s.explanations);

    return (
      <Paper withBorder shadow="lg" p="xl" radius="md">
        <Group justify="apart" mb="md">
          <Group>
            <ThemeIcon size="lg" radius="xl" color={primaryColor}>
              <IconSparkles size={20} />
            </ThemeIcon>
            <Title order={3}>Feedback</Title>
          </Group>
        </Group>

        <Divider mb="xl" />

        {feedback.sentences.length === 0 ? (
          <Alert
            title="No sentences detected"
            color="blue"
            icon={<IconX size={16} />}
            radius="md"
          >
            Please write a longer essay or use complete sentences.
          </Alert>
        ) : (
          <Stack gap="lg">
            <Card withBorder shadow="sm" padding="lg" radius="md">
              <Group gap="xs" mb="md">
                <IconPencil size={20} color={theme.colors[primaryColor][6]} />
                <Text fw={500}>Original Text</Text>
              </Group>
              <Text size="md" lh={1.6}>
                {originalText}
              </Text>
            </Card>
            <Card withBorder shadow="sm" padding="lg" radius="md">
              <Group gap="xs" mb="md">
                <IconCheck size={20} color={theme.colors.green[6]} />
                <Text fw={500}>Corrected Text</Text>
              </Group>
              <Text size="md" lh={1.6}>
                {correctedText}
              </Text>
            </Card>
            <Card withBorder shadow="sm" padding="lg" radius="md">
              <Group gap="xs" mb="md">
                <IconArrowRight size={20} color={theme.colors.violet[6]} />
                <Text fw={500}>Changes</Text>
              </Group>
              <Box mt="md">
                <VisualDiff actual={originalText} expected={correctedText} />
              </Box>
            </Card>
            {allExplanations.length > 0 && (
              <Card withBorder shadow="sm" padding="lg" radius="md">
                <Group gap="xs" mb="md">
                  <IconBulb size={20} color={theme.colors.yellow[6]} />
                  <Text fw={500}>Suggestions</Text>
                </Group>
                <Stack gap="sm" mt="md">
                  {allExplanations.map((explanation, idx) => (
                    <Text key={idx} size="sm" lh={1.6}>
                      • {explanation}
                    </Text>
                  ))}
                </Stack>
              </Card>
            )}
          </Stack>
        )}
      </Paper>
    );
  };

  return (
    <Container size="md" py="xl">
      {/* Section for Generating Prompts */}
      <Paper withBorder shadow="sm" p="lg" mb="xl" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size="lg" variant="light" radius="xl" color="teal">
              <IconWand size={20} />
            </ThemeIcon>
            <Title order={4}>Need Inspiration?</Title>
          </Group>
          {/* Buttons for each language */}
          <Group>
            {langCodes.map((code) => (
              <Button
                key={code}
                onClick={() => handleGeneratePrompts(code)} // Pass the specific code
                leftSection={<IconWand size={rem(16)} />}
                loading={promptsLoading === code} // Show loading only for this button
                disabled={!!promptsLoading} // Disable all buttons if any are loading
                size="sm"
                radius="md"
                variant="light"
                color="teal"
              >
                Generate {getLangName(code)} Prompts
              </Button>
            ))}
          </Group>
        </Group>
        {/* Show a generic loading indicator if any language is loading */}
        {promptsLoading && (
           <Box mt="md" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <Loader size="sm" color="teal" />
             <Text ml="sm" c="dimmed">Generating prompts for {getLangName(promptsLoading)}...</Text>
           </Box>
        )}
        {promptsError && (
          <Alert title="Error" color="red" mt="md" radius="md">
            {promptsError}
          </Alert>
        )}
        {/* Show prompts only when not loading */}
        {prompts.length > 0 && !promptsLoading && selectedLangCode && (
          <Card withBorder radius="md" mt="lg" p="md">
            <Text fw={500} mb="sm">
              Generated {getLangName(selectedLangCode)} Prompts:
            </Text>
            <Stack gap="xs">
              {prompts.map((prompt, index) => (
                <Text key={index} size="sm" lh={1.5}>
                  • {prompt}
                </Text>
              ))}
            </Stack>
          </Card>
        )}
      </Paper>

      {/* Existing Essay Input Section */}
      <Paper
        withBorder
        shadow="lg"
        p="xl"
        mb="xl"
        radius="md"
        styles={{
          root: {
            borderLeft: `4px solid ${theme.colors[primaryColor][6]}`,
            transition: "transform 0.2s ease",
          },
        }}
      >
        <Group mb="md" align="center">
          <ThemeIcon size="lg" variant="light" radius="xl">
            <IconPencil size={20} />
          </ThemeIcon>
          <Title order={4}>Your Essay</Title>
        </Group>

        <Textarea
          placeholder="Write your essay here..."
          description="Write a few sentences or a short paragraph in your target language"
          autosize
          minRows={6}
          maxRows={12}
          value={essay}
          onChange={(e) => setEssay(e.currentTarget.value)}
          mb="lg"
          radius="md"
          styles={{
            input: {
              fontSize: "1.05rem",
              lineHeight: 1.6,
              padding: theme.spacing.md,
            },
          }}
        />
        <Group justify="right">
          <Button
            onClick={handleAnalyze}
            leftSection={<IconSparkles size={rem(16)} />}
            loading={loading}
            disabled={!essay.trim()}
            size="md"
            radius="md"
            variant="gradient"
            gradient={{
              from: theme.colors[primaryColor][7],
              to: theme.colors[primaryColor][5],
              deg: 45,
            }}
          >
            Analyze
          </Button>
        </Group>
      </Paper>

      {loading ? (
        <Paper withBorder shadow="md" p="xl" radius="md">
          <Box
            py="xl"
            style={{
              display: "flex",
              justifyContent: "center",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Loader
              size="lg"
              variant="dots"
              color={theme.colors[primaryColor][6]}
            />
            <Text mt="md" ta="center" c="dimmed">
              Analyzing your writing...
            </Text>
          </Box>
        </Paper>
      ) : (
        feedback && renderFeedback()
      )}
    </Container>
  );
};

export default WritingAssistant;
