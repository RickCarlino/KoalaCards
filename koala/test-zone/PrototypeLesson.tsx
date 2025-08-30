import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Group,
  Progress,
  Stack,
  Text,
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
import { playBlob } from "@/koala/utils/play-blob-audio";
import { useMediaRecorder } from "@/koala/hooks/use-media-recorder";
import { useVoiceTranscription } from "@/koala/review/use-voice-transcription";
import { LangCode } from "@/koala/shared-types";
import { IconMicrophone, IconPlayerStopFilled } from "@tabler/icons-react";

type LessonProps = {
  lesson: InputFlood;
  langCode: string;
};

// Microphone-driven attempt UI
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
  | { t: "paragraph" }
  | { t: "production"; i: number };

export function InputFloodLesson({ lesson, langCode }: LessonProps) {
  const equals = (a: string, b: string) => a.trim() === b.trim();
  const requestSpeech = async (tl: string, en?: string) => {
    if (!tl.trim()) return;
    const res = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tl, en, format: "mp3" }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    await playBlob(blob);
  };
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
  const [passed, setPassed] = useState<Set<string>>(new Set());

  // Microphone + transcription
  const { start, stop, isRecording } = useMediaRecorder();
  const [heard, setHeard] = useState<string>("");
  const [lastMatch, setLastMatch] = useState<boolean | null>(null);

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
    next();
  };

  // Auto-play TTS at the start of Step A to support listen-and-repeat
  useEffect(() => {
    const k = keyFor(step);
    if (passed.has(k)) return;
    if (step.t === "floodA") {
      const it = lesson.flood.A[step.i];
      void requestSpeech(it.text, it.en).catch(() => undefined);
    }
  }, [step, passed, lesson]);

  // Voice flow: press mic, speak, stop -> transcribe -> compare -> advance
  const expectedForStep = (s: StepKind): string => {
    if (s.t === "diagnosis") return lesson.fix.corrected;
    if (s.t === "floodA") return lesson.flood.A[s.i].text;
    if (s.t === "floodB") return lesson.flood.B?.[s.i].text || "";
    if (s.t === "paragraph") return lesson.paragraph;
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
      } catch {
        // surface via UI if needed later
      }
      return;
    }
    const blob = await stop();
    const k = keyFor(step);
    if (passed.has(k)) return;
    const expected = expectedForStep(step);
    const { transcription, isMatch } = await transcribe(blob);
    setHeard(transcription);
    setLastMatch(Boolean(isMatch ?? equals(expected, transcription)));
    if (Boolean(isMatch ?? equals(expected, transcription))) {
      markPassedAndNext();
    }
  };

  // Reset heard/match when step changes
  useEffect(() => {
    setHeard("");
    setLastMatch(null);
  }, [idx]);

  // no manual check; production also uses listen-and-repeat speaking gate

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
                  Speak the corrected answer to continue
                </Text>
                <Group justify="space-between" align="center">
                  <MicButton
                    isRecording={isRecording}
                    onClick={handleRecordToggle}
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
                  <MicButton
                    isRecording={isRecording}
                    onClick={handleRecordToggle}
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
                <Group justify="space-between" align="center">
                  <MicButton
                    isRecording={isRecording}
                    onClick={handleRecordToggle}
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
                  Speak the paragraph to continue
                </Text>
                <Group justify="space-between" align="center">
                  <MicButton
                    isRecording={isRecording}
                    onClick={handleRecordToggle}
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
            <Title order={3}>Production</Title>
            <Text c="dimmed" size="sm">
              {step.i + 1} / {lesson.production.length}
            </Text>
            <Text size="sm" c="dimmed">
              {lesson.production[step.i].prompt_en}
            </Text>
            <Text c="dimmed" size="sm">
              Speak the target-language answer to continue
            </Text>
            <Group justify="space-between" align="center">
              <MicButton
                isRecording={isRecording}
                onClick={handleRecordToggle}
              />
              {heard ? (
                <Text size="sm" c={lastMatch ? "green" : "red"}>
                  Heard: {heard}
                </Text>
              ) : null}
            </Group>
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
