import { useEffect, useMemo, useState } from "react";
import { useHotkeys } from "@mantine/hooks";
import {
  Button,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
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
  production: { prompt_en: string; answer: string }[];
  takeaways: string[];
  fix: { original: string; corrected: string };
};
import { playBlob } from "@/koala/utils/play-blob-audio";
import { trpc } from "@/koala/trpc-config";
import { useMediaRecorder } from "@/koala/hooks/use-media-recorder";
import { useVoiceTranscription } from "@/koala/review/use-voice-transcription";
import { LangCode } from "@/koala/shared-types";
import {
  IconMicrophone,
  IconPlayerStopFilled,
  IconPlayerPlayFilled,
} from "@tabler/icons-react";
import { compare } from "@/koala/quiz-evaluators/evaluator-utils";

type LessonProps = {
  lesson: InputFlood;
  langCode: string;
  onComplete?: () => void;
};

function MicButton({
  isRecording,
  onClick,
  disabled,
}: {
  isRecording: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      leftSection={
        isRecording ? (
          <IconPlayerStopFilled size={18} />
        ) : (
          <IconMicrophone size={18} />
        )
      }
      color={isRecording ? "red" : "pink"}
      variant={isRecording ? "filled" : "light"}
    >
      {isRecording ? "Stop" : "Speak"}
    </Button>
  );
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
  | { t: "production"; i: number };

export function InputFloodLesson({
  lesson,
  langCode,
  onComplete,
}: LessonProps) {
  const steps = useMemo<StepKind[]>(() => {
    const s: StepKind[] = [{ t: "diagnosis" }];
    for (let i = 0; i < lesson.flood.A.length; i++)
      s.push({ t: "floodA", i });
    if (lesson.flood.B && lesson.flood.B.length) {
      for (let i = 0; i < lesson.flood.B.length; i++)
        s.push({ t: "floodB", i });
    }
    for (let i = 0; i < lesson.production.length; i++)
      s.push({ t: "production", i });
    return s;
  }, [lesson]);

  const [idx, setIdx] = useState(0);
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Microphone + transcription
  const { start, stop, isRecording } = useMediaRecorder();
  const [heard, setHeard] = useState<string>("");
  const [lastMatch, setLastMatch] = useState<boolean | null>(null);
  const gradeMutation = trpc.inputFloodGrade.useMutation();
  const [grading, setGrading] = useState(false);
  const [gradeText, setGradeText] = useState<string | null>(null);

  const pct = Math.round(((idx + 1) / steps.length) * 100);
  const step = steps[idx];

  const keyFor = (s: StepKind): string => {
    if (s.t === "floodA") return `A-${s.i}`;
    if (s.t === "floodB") return `B-${s.i}`;
    if (s.t === "production") return `P-${s.i}`;
    return s.t;
  };

  const next = () => {
    setHeard("");
    setLastMatch(null);
    setIdx((i) => Math.min(steps.length - 1, i + 1));
  };

  const markPassedAndNext = () => {
    const k = keyFor(step);
    setPassed((prevSet) => {
      const ns = new Set(prevSet);
      ns.add(k);
      return ns;
    });
    const isLast = idx >= steps.length - 1;
    if (isLast) {
      if (onComplete) onComplete();
      return;
    }
    next();
  };

  const requestSpeech = async (tl: string, en?: string) => {
    if (!tl.trim()) return;
    setIsAudioPlaying(true);
    try {
      const res = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tl, en, format: "mp3" }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      await playBlob(blob);
    } finally {
      setIsAudioPlaying(false);
    }
  };

  useEffect(() => {
    const k = keyFor(step);
    if (passed.has(k)) return;
    if (step.t === "floodA") {
      const it = lesson.flood.A[step.i];
      void requestSpeech(it.text, it.en);
    } else if (step.t === "floodB") {
      const it = lesson.flood.B?.[step.i];
      if (it) void requestSpeech(it.text, it.en);
    }
  }, [step, passed, lesson]);

  const expectedForStep = (s: StepKind): string => {
    if (s.t === "diagnosis") return lesson.fix.corrected;
    if (s.t === "floodA") return lesson.flood.A[s.i].text;
    if (s.t === "floodB") return lesson.flood.B?.[s.i].text || "";
    if (s.t === "production") return lesson.production[s.i].answer;
    return "";
  };

  const { transcribe } = useVoiceTranscription({
    targetText: expectedForStep(steps[idx]),
    langCode: langCode as LangCode,
  });

  const handleRecordToggle = async () => {
    if (!isRecording) {
      try {
        await start();
      } catch {}
      return;
    }
    const blob = await stop();
    const k = keyFor(step);
    if (passed.has(k)) return;
    const expected = expectedForStep(step);
    const { transcription, isMatch } = await transcribe(blob);
    setHeard(transcription);
    setGradeText(null);

    if (step.t === "production") {
      // Grade the spoken production attempt on the server
      setGrading(true);
      try {
        const item = lesson.production[step.i];
        const res = await gradeMutation.mutateAsync({
          language: langCode,
          items: [
            {
              prompt_en: item.prompt_en,
              answer: item.answer,
              attempt: transcription,
            },
          ],
        });
        const g = (
          res as { grades: { score: number; feedback: string }[] }
        ).grades[0];
        const ok = g.score >= 0.5;
        setGradeText(`${ok ? "OK" : "Try again"}: ${g.feedback}`);
        if (ok) {
          markPassedAndNext();
        }
      } catch (e) {
        const m = e instanceof Error ? e.message : "Failed to grade";
        setGradeText(m);
      } finally {
        setGrading(false);
      }
      return;
    }

    const baseMatch = Boolean(isMatch ?? compare(expected, transcription));
    const relaxedMatch =
      step.t === "floodA"
        ? compare(expected, transcription, 3) || baseMatch
        : baseMatch;
    setLastMatch(relaxedMatch);
    if (relaxedMatch) {
      markPassedAndNext();
    }
  };

  useHotkeys([
    [
      "space",
      (e) => {
        e.preventDefault();
        if (isAudioPlaying || step.t === "diagnosis") return;
        void handleRecordToggle();
      },
    ],
  ]);

  useEffect(() => {
    setHeard("");
    setLastMatch(null);
  }, [idx]);

  return (
    <Stack gap="md">
      <Progress value={pct} size="sm" radius="xl" />
      {step.t === "diagnosis" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <DiagnosisCard diagnosis={lesson.diagnosis} fix={lesson.fix} />
            {!passed.has("diagnosis") ? (
              <Group justify="flex-end">
                <Button onClick={markPassedAndNext} variant="light">
                  Next
                </Button>
              </Group>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {step.t === "floodA" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>Step A</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.flood.A.length}
            </Text>
            {!passed.has(keyFor(step)) ? (
              <>
                <Text c="dimmed" size="sm">
                  Speak the sentence to continue
                </Text>
                <Text size="sm" c="dimmed">
                  {lesson.flood.A[step.i].en}
                </Text>
                <Text fw={600}>{lesson.flood.A[step.i].text}</Text>
                <Group justify="space-between" align="center">
                  <Button
                    leftSection={<IconPlayerPlayFilled size={16} />}
                    variant="default"
                    onClick={() =>
                      requestSpeech(
                        lesson.flood.A[step.i].text,
                        lesson.flood.A[step.i].en,
                      )
                    }
                    disabled={isAudioPlaying}
                  >
                    Listen
                  </Button>
                  <MicButton
                    isRecording={isRecording}
                    onClick={handleRecordToggle}
                    disabled={isAudioPlaying}
                  />
                  {heard ? (
                    <Text size="sm" c={lastMatch ? "green" : "red"}>
                      Heard: {heard}
                    </Text>
                  ) : null}
                </Group>
              </>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {step.t === "floodB" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>Step B</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.flood.B?.length || 0}
            </Text>
            {lesson.flood.B?.[step.i].en ? (
              <Text size="sm" c="dimmed">
                {lesson.flood.B?.[step.i].en}
              </Text>
            ) : null}
            {!passed.has(keyFor(step)) ? (
              <>
                <Text c="dimmed" size="sm">
                  Speak the sentence to continue
                </Text>
                <Text fw={600}>{lesson.flood.B?.[step.i].text}</Text>
                <Group justify="space-between" align="center">
                  <Button
                    leftSection={<IconPlayerPlayFilled size={16} />}
                    variant="default"
                    onClick={() =>
                      lesson.flood.B?.[step.i]
                        ? requestSpeech(
                            lesson.flood.B[step.i].text,
                            lesson.flood.B[step.i].en,
                          )
                        : undefined
                    }
                    disabled={isAudioPlaying}
                  >
                    Listen
                  </Button>
                  <MicButton
                    isRecording={isRecording}
                    onClick={handleRecordToggle}
                    disabled={isAudioPlaying}
                  />
                  {heard ? (
                    <Text size="sm" c={lastMatch ? "green" : "red"}>
                      Heard: {heard}
                    </Text>
                  ) : null}
                </Group>
              </>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {step.t === "production" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>How Would You Say This?</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.production.length}
            </Text>
            <Text fw={700} style={{ fontSize: 20 }}>
              {lesson.production[step.i].prompt_en}
            </Text>
            <Text c="dimmed" size="sm">
              Speak the target-language answer to continue
            </Text>
            <Group justify="space-between" align="center">
              <MicButton
                isRecording={isRecording}
                onClick={handleRecordToggle}
                disabled={isAudioPlaying}
              />
            </Group>
            {grading ? (
              <Text size="sm" c="dimmed">
                Grading...
              </Text>
            ) : null}
            {gradeText ? <Text size="sm">{gradeText}</Text> : null}
          </Stack>
        </Card>
      ) : null}

      
    </Stack>
  );
}
