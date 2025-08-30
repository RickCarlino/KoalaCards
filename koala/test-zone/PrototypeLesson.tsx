import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
// Local, minimal types for the prototype
type Sentence = { text: string; en: string };
type InputFlood = {
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
import { trpc } from "@/koala/trpc-config";

type LessonProps = {
  lesson: InputFlood;
  langCode: string;
};

export function DiagnosisCard({
  diagnosis,
  fix,
}: {
  diagnosis: InputFlood["diagnosis"];
  fix: InputFlood["fix"];
}) {
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap={8}>
        <Title order={3}>Diagnosis</Title>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Mistake
          </Text>
          <Text c="red">❌ {fix.original}</Text>
          <Text c="green">✅ {fix.corrected}</Text>
        </Stack>
        <Text fw={600}>{diagnosis.target_label}</Text>
        {diagnosis.contrast_label ? (
          <Text c="dimmed" size="sm">
            Contrast: {diagnosis.contrast_label}
          </Text>
        ) : null}
        <Text size="sm">{diagnosis.why_error}</Text>
        <Stack gap={4}>
          {diagnosis.rules.map((r, idx) => (
            <Text key={idx} size="sm">
              • {r}
            </Text>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}

type StepKind =
  | { t: "diagnosis" }
  | { t: "floodA"; i: number }
  | { t: "floodB"; i: number }
  | { t: "paragraph" }
  | { t: "production"; i: number };

export function InputFloodLesson({ lesson, langCode }: LessonProps) {
  const steps = useMemo<StepKind[]>(() => {
    const s: StepKind[] = [{ t: "diagnosis" }];
    for (let i = 0; i < lesson.flood.A.length; i++)
      s.push({ t: "floodA", i });
    if (lesson.flood.B && lesson.flood.B.length) {
      for (let i = 0; i < lesson.flood.B.length; i++)
        s.push({ t: "floodB", i });
    }
    s.push({ t: "paragraph" });
    for (let i = 0; i < lesson.production.length; i++)
      s.push({ t: "production", i });
    return s;
  }, [lesson]);

  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState("");
  const [grading, setGrading] = useState(false);
  const [gradeText, setGradeText] = useState<string | null>(null);
  const gradeMutation = trpc.inputFloodGrade.useMutation();

  const pct = Math.round(((idx + 1) / steps.length) * 100);
  const step = steps[idx];

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => {
    setGradeText(null);
    setAttempt("");
    setIdx((i) => Math.min(steps.length - 1, i + 1));
  };

  const onCheck = async () => {
    if (step.t !== "production") return;
    const item = lesson.production[step.i];
    setGrading(true);
    setGradeText(null);
    try {
      const res = await gradeMutation.mutateAsync({
        language: langCode,
        items: [
          {
            prompt_en: item.prompt_en,
            answer: item.answer,
            attempt,
          },
        ],
      });
      const g = (res as { grades: { score: number; feedback: string }[] })
        .grades[0];
      setGradeText(`Score ${g.score}: ${g.feedback}`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Failed to grade";
      setGradeText(m);
    } finally {
      setGrading(false);
    }
  };

  return (
    <Stack gap="md">
      <Progress value={pct} size="sm" radius="xl" />
      {step.t === "diagnosis" ? (
        <DiagnosisCard diagnosis={lesson.diagnosis} fix={lesson.fix} />
      ) : null}

      {step.t === "floodA" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>Input Flood A</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.flood.A.length}
            </Text>
            <Text style={{ fontSize: 24 }}>
              {lesson.flood.A[step.i].text}
            </Text>
            <Text size="sm" c="dimmed">
              {lesson.flood.A[step.i].en}
            </Text>
          </Stack>
        </Card>
      ) : null}

      {step.t === "floodB" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>Input Flood B</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.flood.B?.length || 0}
            </Text>
            <Text style={{ fontSize: 24 }}>
              {lesson.flood.B?.[step.i].text}
            </Text>
            {lesson.flood.B?.[step.i].en ? (
              <Text size="sm" c="dimmed">
                {lesson.flood.B?.[step.i].en}
              </Text>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {/* Minimal pairs removed */}

      {step.t === "paragraph" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>Paragraph</Title>
            <Text style={{ maxWidth: 700, lineHeight: 1.6 }}>
              {lesson.paragraph}
            </Text>
          </Stack>
        </Card>
      ) : null}

      {step.t === "production" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>Production</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.production.length}
            </Text>
            <Text size="sm" c="dimmed">
              {lesson.production[step.i].prompt_en}
            </Text>
            <TextInput
              placeholder="Type your answer"
              size="md"
              value={attempt}
              onChange={(e) => setAttempt(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button onClick={onCheck} loading={grading} variant="light">
                Check
              </Button>
            </Group>
            {gradeText ? <Text size="sm">{gradeText}</Text> : null}
          </Stack>
        </Card>
      ) : null}

      <Group justify="space-between">
        <Button onClick={prev} variant="subtle" disabled={idx === 0}>
          Back
        </Button>
        <Button onClick={next}>
          {idx < steps.length - 1 ? "Next" : "Finish"}
        </Button>
      </Group>
    </Stack>
  );
}
