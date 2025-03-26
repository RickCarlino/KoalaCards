import { useState } from "react";
import { trpc } from "@/koala/trpc-config";
import { useRouter } from "next/router";
import { notifications } from "@mantine/notifications";
import { GetServerSideProps } from "next";
import { getServersideUser } from "@/koala/get-serverside-user";
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
} from "@tabler/icons-react";

import type { EssayResponse } from "@/koala/trpc-routes/grade-writing";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  return {
    props: {},
  };
};

const WritingAssistant = () => {
  const router = useRouter();
  const [essay, setEssay] = useState("");
  const [feedback, setFeedback] = useState<EssayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const theme = useMantineTheme();
  const primaryColor = theme.primaryColor || "blue";

  // Get the language code from the URL query parameter if available
  const langCode =
    typeof router.query.lang === "string" ? router.query.lang : undefined;

  // Use the tRPC mutation
  const gradeWritingMutation = trpc.gradeWriting.useMutation({
    onError: (error) => {
      notifications.show({
        title: "Error",
        message:
          error.message || "Failed to analyze your writing. Please try again.",
        color: "red",
      });
    },
  });

  const handleAnalyze = async () => {
    if (!essay.trim()) return;

    setLoading(true);
    try {
      const result = await gradeWritingMutation.mutateAsync({
        text: essay,
        langCode,
      });
      setFeedback(result);
    } catch (error) {
      console.error("Error analyzing essay:", error);
    } finally {
      setLoading(false);
    }
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
