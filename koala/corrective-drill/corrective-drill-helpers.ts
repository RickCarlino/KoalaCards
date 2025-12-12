import type { CorrectiveDrillLesson } from "@/koala/types/corrective-drill";
import { compare } from "@/koala/quiz-evaluators/evaluator-utils";

export type StepType = "diagnosis" | "target" | "contrast" | "production";
export type Step = { type: StepType };

const STEP_KEYS: Record<StepType, string> = {
  diagnosis: "diagnosis",
  target: "A",
  contrast: "B",
  production: "P",
};

export function buildSteps(lesson: CorrectiveDrillLesson): Step[] {
  const steps: Step[] = [{ type: "diagnosis" }, { type: "target" }];
  if (lesson.contrast) {
    steps.push({ type: "contrast" });
  }
  steps.push({ type: "production" });
  return steps;
}

export function stepKey(step: Step): string {
  return STEP_KEYS[step.type];
}

export function expectedForStep(
  lesson: CorrectiveDrillLesson,
  step: Step,
): string {
  if (step.type === "diagnosis") {
    return lesson.diagnosis.corrected;
  }
  if (step.type === "target") {
    return lesson.target.example.text;
  }
  if (step.type === "contrast") {
    return lesson.contrast?.example.text ?? "";
  }
  return lesson.production.answer;
}

export function autoSpeechForStep(
  lesson: CorrectiveDrillLesson,
  step: Step,
): { tl: string; en?: string } | null {
  if (step.type === "diagnosis") {
    return { tl: lesson.diagnosis.error_explanation };
  }
  if (step.type === "target") {
    return {
      tl: lesson.target.example.text,
      en: lesson.target.example.en,
    };
  }
  if (step.type === "contrast") {
    const example = lesson.contrast?.example;
    if (!example) {
      return null;
    }
    return { tl: example.text, en: example.en };
  }
  return null;
}

export function isMatchForStep(params: {
  step: Step;
  expected: string;
  transcription: string;
  isMatch: boolean | null | undefined;
}): boolean {
  const baseMatch =
    typeof params.isMatch === "boolean"
      ? params.isMatch
      : compare(params.expected, params.transcription);
  if (params.step.type !== "target") {
    return baseMatch;
  }
  return compare(params.expected, params.transcription, 3) || baseMatch;
}
