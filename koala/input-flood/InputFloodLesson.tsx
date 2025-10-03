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
import type { InputFloodLesson as InputFloodLessonType } from "@/koala/types/input-flood";
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
import { useUserSettings } from "@/koala/settings-provider";

type LessonProps = {
  lesson: InputFloodLessonType;
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
  targetLabel,
  contrastLabel,
}: {
  diagnosis: InputFloodLessonType["diagnosis"];
  targetLabel?: string;
  contrastLabel?: string | null;
}) {
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap={8}>
        <Title order={3}>Diagnosis</Title>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Mistake
          </Text>
          <Text c="red">❌ {diagnosis.original}</Text>
          <Text c="green">✅ {diagnosis.corrected}</Text>
        </Stack>
        {targetLabel ? <Text fw={600}>{targetLabel}</Text> : null}
        {contrastLabel ? (
          <Text c="dimmed" size="sm">
            Contrast: {contrastLabel}
          </Text>
        ) : null}
        <Text size="sm">{diagnosis.error_explanation}</Text>
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
  | { t: "floodTarget"; i: number }
  | { t: "floodContrast"; i: number }
  | { t: "production"; i: number };

export function InputFloodLesson({
  lesson,
  langCode,
  onComplete,
}: LessonProps) {
  const userSettings = useUserSettings();
  const steps = useMemo<StepKind[]>(() => {
    const s: StepKind[] = [{ t: "diagnosis" }];
    for (let i = 0; i < lesson.flood.target.items.length; i++) {
      s.push({ t: "floodTarget", i });
    }
    if (lesson.flood.contrast && lesson.flood.contrast.items.length) {
      for (let i = 0; i < lesson.flood.contrast.items.length; i++) {
        s.push({ t: "floodContrast", i });
      }
    }
    for (let i = 0; i < lesson.production.length; i++) {
      s.push({ t: "production", i });
    }
    return s;
  }, [lesson]);

  const [idx, setIdx] = useState(0);
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const { start, stop, isRecording } = useMediaRecorder();
  const [heard, setHeard] = useState<string>("");
  const [lastMatch, setLastMatch] = useState<boolean | null>(null);
  const gradeMutation = trpc.gradeUtterance.useMutation();
  const [grading, setGrading] = useState(false);
  const [gradeText, setGradeText] = useState<string | null>(null);

  const pct = Math.round(((idx + 1) / steps.length) * 100);
  const step = steps[idx];

  const keyFor = (s: StepKind): string => {
    if (s.t === "floodTarget") {
      return `A-${s.i}`;
    }
    if (s.t === "floodContrast") {
      return `B-${s.i}`;
    }
    if (s.t === "production") {
      return `P-${s.i}`;
    }
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
      onComplete?.();
      return;
    }
    next();
  };

  const requestSpeech = async (tl: string, en?: string) => {
    if (!tl.trim()) {
      return;
    }
    setIsAudioPlaying(true);
    try {
      const res = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tl, en, format: "mp3" }),
      });
      if (!res.ok) {
        return;
      }
      const blob = await res.blob();
      await playBlob(blob, userSettings.playbackSpeed);
    } finally {
      setIsAudioPlaying(false);
    }
  };

  useEffect(() => {
    const k = keyFor(step);
    if (passed.has(k)) {
      return;
    }
    if (step.t === "floodTarget") {
      const it = lesson.flood.target.items[step.i];
      void requestSpeech(it.text, it.en);
      return;
    }
    if (step.t === "floodContrast") {
      const it = lesson.flood.contrast?.items[step.i];
      if (it) {
        void requestSpeech(it.text, it.en);
      }
    }
  }, [step, passed, lesson]);

  const expectedForStep = (s: StepKind): string => {
    if (s.t === "diagnosis") {
      return lesson.diagnosis.corrected;
    }
    if (s.t === "floodTarget") {
      return lesson.flood.target.items[s.i].text;
    }
    if (s.t === "floodContrast") {
      return lesson.flood.contrast?.items[s.i].text || "";
    }
    if (s.t === "production") {
      return lesson.production[s.i].answer;
    }
    return "";
  };

  const { transcribe } = useVoiceTranscription({
    targetText: expectedForStep(steps[idx]),
    langCode: langCode as LangCode,
  });

  const handleRecordToggle = async () => {
    if (!isRecording) {
      await start().catch(() => undefined);
      return;
    }
    const blob = await stop();
    const k = keyFor(step);
    if (passed.has(k)) {
      return;
    }
    const expected = expectedForStep(step);
    const { transcription, isMatch } = await transcribe(blob);
    setHeard(transcription);
    setGradeText(null);

    if (step.t === "production") {
      // Fuzzy pre-check: if close enough, accept without AI grading
      if (compare(expected, transcription)) {
        setGradeText("Good match");
        markPassedAndNext();
        return;
      }
      setGrading(true);
      try {
        const item = lesson.production[step.i];
        const res = await gradeMutation.mutateAsync({
          langCode: langCode as LangCode,
          prompt_en: item.prompt_en,
          answer: item.answer,
          attempt: transcription,
        });
        const ok = res.isCorrect;
        setGradeText(`${ok ? "OK" : "Try again"}: ${res.feedback}`);
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
      step.t === "floodTarget"
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
        if (isAudioPlaying || step.t === "diagnosis") {
          return;
        }
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
            <DiagnosisCard
              diagnosis={lesson.diagnosis}
              targetLabel={lesson.flood.target.label}
              contrastLabel={lesson.flood.contrast?.label || null}
            />
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

      {step.t === "floodTarget" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>Step A</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.flood.target.items.length}
            </Text>
            {!passed.has(keyFor(step)) ? (
              <>
                <Text c="dimmed" size="sm">
                  Speak the sentence to continue
                </Text>
                <Text size="sm" c="dimmed">
                  {lesson.flood.target.items[step.i].en}
                </Text>
                <Text fw={600}>
                  {lesson.flood.target.items[step.i].text}
                </Text>
                <Group justify="space-between" align="center">
                  <Button
                    leftSection={<IconPlayerPlayFilled size={16} />}
                    variant="default"
                    onClick={() =>
                      requestSpeech(
                        lesson.flood.target.items[step.i].text,
                        lesson.flood.target.items[step.i].en,
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

      {step.t === "floodContrast" ? (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>Step B</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.flood.contrast?.items.length || 0}
            </Text>
            {lesson.flood.contrast?.items[step.i].en ? (
              <Text size="sm" c="dimmed">
                {lesson.flood.contrast?.items[step.i].en}
              </Text>
            ) : null}
            {!passed.has(keyFor(step)) ? (
              <>
                <Text c="dimmed" size="sm">
                  Speak the sentence to continue
                </Text>
                <Text fw={600}>
                  {lesson.flood.contrast?.items[step.i].text}
                </Text>
                <Group justify="space-between" align="center">
                  <Button
                    leftSection={<IconPlayerPlayFilled size={16} />}
                    variant="default"
                    onClick={() =>
                      lesson.flood.contrast?.items[step.i]
                        ? requestSpeech(
                            lesson.flood.contrast.items[step.i].text,
                            lesson.flood.contrast.items[step.i].en,
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
            <Title order={3}>Respond to the Prompt</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.production.length}
            </Text>
            <Text fw={700} style={{ fontSize: 20 }}>
              {lesson.production[step.i].prompt_en}
            </Text>
            <Text c="dimmed" size="sm">
              Speak your answer to continue
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
