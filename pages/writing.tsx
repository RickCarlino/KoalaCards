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
} from "@mantine/core";
import {
  IconCheck,
  IconX,
  IconBulb,
  IconPencil,
  IconArrowRight,
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
    const originalText = feedback.sentences.map(s => s.input).join(" ");
    
    // Join all corrected sentences into a single paragraph
    const correctedText = feedback.sentences.map(s => s.ok ? s.input : s.correction).join(" ");
    
    // Collect all explanations from sentences that have corrections
    const allExplanations = feedback.sentences
      .filter(s => !s.ok)
      .flatMap(s => s.explanations);

    return (
      <Stack gap="md">
        <Group justify="apart">
          <Title order={3}>Feedback</Title>
        </Group>

        <Divider />

        {feedback.sentences.length === 0 ? (
          <Alert title="No sentences detected" color="blue">
            Please write a longer essay or use complete sentences.
          </Alert>
        ) : (
          <Stack gap="lg">
            {/* Original Text */}
            <Card withBorder shadow="sm" padding="md" radius="md">
              <Group gap="xs" mb="md">
                <IconPencil size={20} color={theme.colors.blue[6]} />
                <Text fw={500}>Original Text</Text>
              </Group>
              <Text>{originalText}</Text>
            </Card>

            {/* Corrected Text */}
            <Card withBorder shadow="sm" padding="md" radius="md">
              <Group gap="xs" mb="md">
                <IconCheck size={20} color={theme.colors.green[6]} />
                <Text fw={500}>Corrected Text</Text>
              </Group>
              <Text>{correctedText}</Text>
            </Card>

            {/* Visual Diff */}
            <Card withBorder shadow="sm" padding="md" radius="md">
              <Group gap="xs" mb="md">
                <IconArrowRight size={20} color={theme.colors.violet[6]} />
                <Text fw={500}>Changes</Text>
              </Group>
              <VisualDiff actual={originalText} expected={correctedText} />
            </Card>

            {/* Explanations */}
            {allExplanations.length > 0 && (
              <Card withBorder shadow="sm" padding="md" radius="md">
                <Group gap="xs" mb="md">
                  <IconBulb size={20} color={theme.colors.yellow[6]} />
                  <Text fw={500}>Suggestions</Text>
                </Group>
                <Stack gap="xs">
                  {allExplanations.map((explanation, idx) => (
                    <Text key={idx} size="sm">
                      • {explanation}
                    </Text>
                  ))}
                </Stack>
              </Card>
            )}
          </Stack>
        )}
      </Stack>
    );
  };

  return (
    <Container size="md" py="xl">
      <Title order={1} mb="lg" ta="center">
        Writing Assistant
      </Title>
      <Text color="dimmed" mb="xl" ta="center">
        Write a short essay or sentences in your target language and get instant
        feedback
      </Text>

      <Paper withBorder shadow="md" p="md" mb="xl">
        <Textarea
          placeholder="Write your essay here..."
          label="Your Essay"
          description="Write a few sentences or a short paragraph in your target language"
          autosize
          minRows={6}
          maxRows={12}
          value={essay}
          onChange={(e) => setEssay(e.currentTarget.value)}
          mb="md"
        />
        <Group justify="right">
          <Button
            onClick={handleAnalyze}
            leftSection={<IconPencil size={rem(16)} />}
            loading={loading}
            disabled={!essay.trim()}
          >
            Analyze
          </Button>
        </Group>
      </Paper>

      {loading ? (
        <Box py="xl" style={{ display: "flex", justifyContent: "center" }}>
          <Loader size="lg" variant="dots" />
        </Box>
      ) : (
        feedback && renderFeedback()
      )}
    </Container>
  );
};

export default WritingAssistant;
