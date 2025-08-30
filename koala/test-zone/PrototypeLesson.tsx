import { useEffect, useMemo, useRef, useState } from "react";
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

function CopyIndicator({
  expected,
  attempt,
}: {
  expected: string;
  attempt: string;
}) {
  const len = Math.min(attempt.length, expected.length);
  let mismatchAt = -1;
  for (let i = 0; i < len; i++) {
    if (attempt[i] !== expected[i]) {
      mismatchAt = i;
      break;
    }
  }
  const matchedLen = mismatchAt === -1 ? len : mismatchAt;
  const parts: JSX.Element[] = [];
  if (matchedLen > 0) {
    parts.push(
      <span
        key="ok"
        style={{ color: "var(--mantine-color-green-7)", fontWeight: 700 }}
      >
        {expected.slice(0, matchedLen)}
      </span>,
    );
  }
  if (mismatchAt >= 0) {
    parts.push(
      <span
        key="bad"
        style={{
          color: "var(--mantine-color-red-7)",
          fontWeight: 700,
          textDecoration: "underline",
        }}
      >
        {expected[mismatchAt]}
      </span>,
    );
  }
  const restStart = mismatchAt >= 0 ? mismatchAt + 1 : matchedLen;
  const rest = expected.slice(restStart);
  if (rest) {
    parts.push(
      <span key="rest" style={{ color: "var(--mantine-color-dimmed)" }}>
        {rest}
      </span>,
    );
  }
  if (attempt.length > expected.length) {
    parts.push(
      <span
        key="extra"
        style={{ color: "var(--mantine-color-red-7)", fontWeight: 700 }}
      >
        {" "}
        (+{attempt.length - expected.length})
      </span>,
    );
  }
  return <Text style={{ fontSize: 18, lineHeight: 1.6 }}>{parts}</Text>;
}

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
  const equals = (a: string, b: string) => a.trim() === b.trim();
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [grading, setGrading] = useState(false);
  const [gradeText, setGradeText] = useState<string | null>(null);
  const gradeMutation = trpc.inputFloodGrade.useMutation();
  const [passed, setPassed] = useState<Set<string>>(new Set());

  const pct = Math.round(((idx + 1) / steps.length) * 100);
  const step = steps[idx];

  const keyFor = (s: StepKind): string => {
    if (s.t === "floodA") return `A-${s.i}`;
    if (s.t === "floodB") return `B-${s.i}`;
    if (s.t === "production") return `P-${s.i}`;
    return s.t;
  };

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => {
    setGradeText(null);
    setAttempt("");
    setIdx((i) => Math.min(steps.length - 1, i + 1));
  };

  const markPassedAndNext = () => {
    const k = keyFor(step);
    setPassed((prevSet) => {
      const ns = new Set(prevSet);
      ns.add(k);
      return ns;
    });
    next();
  };

  // Auto-advance when the typed input matches the required text for the step
  useEffect(() => {
    const k = keyFor(step);
    if (passed.has(k)) return;

    if (step.t === "diagnosis") {
      if (equals(lesson.fix.corrected, attempt)) markPassedAndNext();
      return;
    }
    if (step.t === "floodA") {
      const expected = lesson.flood.A[step.i].text;
      if (equals(expected, attempt)) markPassedAndNext();
      return;
    }
    if (step.t === "floodB") {
      const expected = lesson.flood.B?.[step.i].text || "";
      if (expected && equals(expected, attempt)) markPassedAndNext();
      return;
    }
    if (step.t === "paragraph") {
      if (equals(lesson.paragraph, attempt)) markPassedAndNext();
      return;
    }
    if (step.t === "production") {
      const expected = lesson.production[step.i].answer;
      if (equals(expected, attempt)) markPassedAndNext();
    }
  }, [attempt, step, lesson, passed]);

  // Keep the active step's input focused for smooth typing
  useEffect(() => {
    const k = keyFor(step);
    if (passed.has(k)) return;
    // small timeout to allow mount
    const id = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
    return () => clearTimeout(id);
  }, [step, passed]);

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
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <DiagnosisCard diagnosis={lesson.diagnosis} fix={lesson.fix} />
            {!passed.has("diagnosis") ? (
              <>
                <Text c="dimmed" size="sm">
                  Type the corrected answer to continue
                </Text>
                <CopyIndicator
                  expected={lesson.fix.corrected}
                  attempt={attempt}
                />
                <TextInput
                  placeholder="Type here…"
                  size="md"
                  value={attempt}
                  onChange={(e) => setAttempt(e.currentTarget.value)}
                  ref={inputRef}
                  autoFocus
                />
              </>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {step.t === "floodA" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>Input Flood A</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.flood.A.length}
            </Text>
            <CopyIndicator
              expected={lesson.flood.A[step.i].text}
              attempt={attempt}
            />
            <Text size="sm" c="dimmed">
              {lesson.flood.A[step.i].en}
            </Text>
            {!passed.has(keyFor(step)) ? (
              <>
                <Text c="dimmed" size="sm">
                  Type the sentence to continue
                </Text>
                <CopyIndicator
                  expected={lesson.flood.A[step.i].text}
                  attempt={attempt}
                />
                <TextInput
                  placeholder="Type here…"
                  size="md"
                  value={attempt}
                  onChange={(e) => setAttempt(e.currentTarget.value)}
                  ref={inputRef}
                  autoFocus
                />
              </>
            ) : null}
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
            <CopyIndicator
              expected={lesson.flood.B?.[step.i].text || ""}
              attempt={attempt}
            />
            {lesson.flood.B?.[step.i].en ? (
              <Text size="sm" c="dimmed">
                {lesson.flood.B?.[step.i].en}
              </Text>
            ) : null}
            {!passed.has(keyFor(step)) ? (
              <>
                <Text c="dimmed" size="sm">
                  Type the sentence to continue
                </Text>
                <CopyIndicator
                  expected={lesson.flood.B?.[step.i].text || ""}
                  attempt={attempt}
                />
                <TextInput
                  placeholder="Type here…"
                  size="md"
                  value={attempt}
                  onChange={(e) => setAttempt(e.currentTarget.value)}
                  ref={inputRef}
                  autoFocus
                />
              </>
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
            {!passed.has("paragraph") ? (
              <>
                <Text c="dimmed" size="sm">
                  Type the paragraph to continue
                </Text>
                <CopyIndicator
                  expected={lesson.paragraph}
                  attempt={attempt}
                />
                <TextInput
                  placeholder="Type here…"
                  size="md"
                  value={attempt}
                  onChange={(e) => setAttempt(e.currentTarget.value)}
                  ref={inputRef}
                  autoFocus
                />
              </>
            ) : null}
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
            <Text c="dimmed" size="sm">
              Type the target-language answer to continue
            </Text>
            <TextInput
              placeholder="Type your answer"
              size="md"
              value={attempt}
              onChange={(e) => setAttempt(e.currentTarget.value)}
              ref={inputRef}
              autoFocus
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

      <Group justify="flex-start">
        <Button onClick={prev} variant="subtle" disabled={idx === 0}>
          Back
        </Button>
      </Group>
    </Stack>
  );
}
