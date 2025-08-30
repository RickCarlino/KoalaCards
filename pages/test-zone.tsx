import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { InputFloodLesson } from "@/koala/test-zone/PrototypeLesson";
import { trpc } from "@/koala/trpc-config";

// Minimal local types to avoid spreading prototype types
type Sentence = { text: string; en: string };
type InputFloodLite = {
  language: string;
  diagnosis: {
    target_label: string;
    contrast_label?: string | null;
    why_error: string;
    rules: string[];
  };
  flood: { A: Sentence[]; B?: Sentence[] | null };
  paragraph: string;
  production: { prompt_en: string; answer: string }[];
  takeaways: string[];
  fix: { original: string; corrected: string };
};
type GenerateResponseLite = {
  lesson: InputFloodLite;
  source: { quizResultId: number; langCode: string };
};

export default function TestZone() {
  const [data, setData] = useState<GenerateResponseLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Step-by-step grading is handled inside the lesson component

  const gen = trpc.inputFloodGenerate.useMutation();
  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gen.mutateAsync({});
      setData(res as GenerateResponseLite);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Failed to load";
      setError(m);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Center style={{ width: "100%", padding: "1.5rem" }}>
      <Stack style={{ width: "min(1000px, 92%)" }} gap="lg">
        <Group justify="space-between">
          <Title order={2}>Test Zone: Input Flood</Title>
          <Button onClick={run} variant="light" size="md">
            New random mistake
          </Button>
        </Group>
        {loading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : null}
        {error ? (
          <Card withBorder padding="md">
            <Text c="red">{error}</Text>
          </Card>
        ) : null}
        {!loading && !error && !data ? (
          <Card withBorder padding="md">
            <Stack>
              <Text>No recent wrong answers found.</Text>
              <Text c="dimmed" size="sm">
                Try practicing first, then come back to generate a lesson.
              </Text>
            </Stack>
          </Card>
        ) : null}
        {data ? (
          <InputFloodLesson
            lesson={data.lesson}
            langCode={data.source.langCode}
          />
        ) : null}
      </Stack>
    </Center>
  );
}
