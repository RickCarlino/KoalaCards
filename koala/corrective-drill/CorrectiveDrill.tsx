import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "@mantine/hooks";
import { Card, Progress, Stack } from "@mantine/core";
import type { CorrectiveDrillLesson } from "@/koala/types/corrective-drill";
import { playBlobExclusive } from "@/koala/utils/play-blob-audio";
import { trpc } from "@/koala/trpc-config";
import { useMediaRecorder } from "@/koala/hooks/use-media-recorder";
import { useVoiceTranscription } from "@/koala/review/use-voice-transcription";
import { parseLangCode } from "@/koala/shared-types";
import { compare } from "@/koala/quiz-evaluators/evaluator-utils";
import { useUserSettings } from "@/koala/settings-provider";
import {
  autoSpeechForStep,
  buildSteps,
  expectedForStep,
  isMatchForStep,
  stepKey,
} from "@/koala/corrective-drill/corrective-drill-helpers";
import { CorrectiveDrillStep } from "@/koala/corrective-drill/CorrectiveDrillStep";
export { DiagnosisCard } from "@/koala/corrective-drill/components/DiagnosisCard";

type LessonProps = {
  lesson: CorrectiveDrillLesson;
  langCode: string;
  onComplete?: () => void;
};

export function CorrectiveDrill({
  lesson,
  langCode,
  onComplete,
}: LessonProps) {
  const userSettings = useUserSettings();
  const resolvedLangCode = parseLangCode(langCode) ?? "ko";
  const steps = useMemo(() => buildSteps(lesson), [lesson]);

  const [idx, setIdx] = useState(0);
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const { start, stop, isRecording } = useMediaRecorder();
  const [heard, setHeard] = useState<string>("");
  const [lastMatch, setLastMatch] = useState<boolean | null>(null);
  const gradeMutation = trpc.gradeUtterance.useMutation();
  const [grading, setGrading] = useState(false);
  const [gradeText, setGradeText] = useState<string | null>(null);
  const spokenRef = useRef<Set<string>>(new Set());

  const pct = Math.round(((idx + 1) / steps.length) * 100);
  const step = steps[idx];
  const stepPassed = passed.has(stepKey(step));

  const next = useCallback(() => {
    setHeard("");
    setLastMatch(null);
    setIdx((i) => Math.min(steps.length - 1, i + 1));
  }, [steps.length]);

  const markPassedAndNext = useCallback(() => {
    const k = stepKey(step);
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
  }, [idx, next, onComplete, step, steps.length]);

  const requestSpeech = useCallback(
    async (tl: string, en?: string) => {
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
        await playBlobExclusive(blob, userSettings.playbackSpeed);
      } finally {
        setIsAudioPlaying(false);
      }
    },
    [userSettings.playbackSpeed],
  );

  useEffect(() => {
    const k = stepKey(step);
    if (passed.has(k) || spokenRef.current.has(k)) {
      return;
    }
    const payload = autoSpeechForStep(lesson, step);
    if (!payload) {
      return;
    }
    spokenRef.current.add(k);
    void requestSpeech(payload.tl, payload.en);
  }, [lesson, passed, requestSpeech, step]);

  const { transcribe } = useVoiceTranscription({
    targetText: expectedForStep(lesson, steps[idx]),
    langCode: resolvedLangCode,
  });

  const handleRecordToggle = async () => {
    if (!isRecording) {
      await start().catch(() => undefined);
      return;
    }
    const blob = await stop();
    if (stepPassed) {
      return;
    }
    const expected = expectedForStep(lesson, step);
    const { transcription, isMatch } = await transcribe(blob);
    setHeard(transcription);
    setGradeText(null);

    if (step.type === "production") {
      if (compare(expected, transcription)) {
        setGradeText("Good match");
        markPassedAndNext();
        return;
      }
      setGrading(true);
      try {
        const item = lesson.production;
        const res = await gradeMutation.mutateAsync({
          langCode: resolvedLangCode,
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

    const relaxedMatch = isMatchForStep({
      step,
      expected,
      transcription,
      isMatch,
    });
    setLastMatch(relaxedMatch);
    if (relaxedMatch) {
      markPassedAndNext();
    }
  };

  const handleSpace = useCallback(
    (e: KeyboardEvent) => {
      if (step.type === "diagnosis") {
        if (!stepPassed) {
          e.preventDefault();
          markPassedAndNext();
        }
        return;
      }
      if (isAudioPlaying) {
        return;
      }
      e.preventDefault();
      void handleRecordToggle();
    },
    [isAudioPlaying, markPassedAndNext, step.type, stepPassed],
  );

  useHotkeys([["space", handleSpace]]);

  useEffect(() => {
    setHeard("");
    setLastMatch(null);
  }, [idx]);

  const handleListenAgain = useCallback(() => {
    const payload = autoSpeechForStep(lesson, step);
    if (!payload) {
      return;
    }
    void requestSpeech(payload.tl, payload.en);
  }, [lesson, requestSpeech, step]);

  return (
    <Card withBorder padding="lg">
      <Stack gap="md">
        <Progress value={pct} size="sm" radius="xl" />
        <CorrectiveDrillStep
          lesson={lesson}
          step={step}
          isStepPassed={stepPassed}
          isAudioPlaying={isAudioPlaying}
          isRecording={isRecording}
          heard={heard}
          lastMatch={lastMatch}
          grading={grading}
          gradeText={gradeText}
          onListenAgain={handleListenAgain}
          onStartDiagnosis={markPassedAndNext}
          onMicToggle={handleRecordToggle}
        />
      </Stack>
    </Card>
  );
}
