function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripLeadingQuestionNumbering(value: string): string {
  return value.replace(/^\s*\d+[.)\-\s]+/, "").trim();
}

function hasLatinLetters(value: string): boolean {
  return /[A-Za-z]/.test(value);
}

export function normalizeKoreanQuestion(value: string): string {
  const stripped = stripLeadingQuestionNumbering(value);
  const collapsed = collapseWhitespace(stripped);

  if (!collapsed || hasLatinLetters(collapsed)) {
    return "";
  }

  const normalizedPunctuation = collapsed.replace(/？/g, "?");
  if (normalizedPunctuation.endsWith("?")) {
    return normalizedPunctuation;
  }

  return `${normalizedPunctuation}?`;
}

export function buildFallbackKoreanQuestions(
  questionCount: number,
  fallbackQuestions: string[],
): string[] {
  const questions: string[] = [];

  for (let index = 0; index < questionCount; index += 1) {
    const fallback =
      fallbackQuestions[index % fallbackQuestions.length] ??
      "이 글의 핵심 내용은 무엇인가요?";
    const normalizedFallback = normalizeKoreanQuestion(fallback);
    questions.push(
      normalizedFallback || "이 글의 핵심 내용은 무엇인가요?",
    );
  }

  return questions;
}

function appendUniqueQuestions(
  target: string[],
  source: string[],
  questionCount: number,
): string[] {
  for (const question of source) {
    const normalized = normalizeKoreanQuestion(question);
    if (!normalized || target.includes(normalized)) {
      continue;
    }

    target.push(normalized);
    if (target.length >= questionCount) {
      return target.slice(0, questionCount);
    }
  }

  return target;
}

export function mergeQuestionLists(options: {
  preferredQuestions: string[];
  fallbackQuestions: string[];
  questionCount: number;
}): string[] {
  const merged = appendUniqueQuestions(
    [],
    options.preferredQuestions,
    options.questionCount,
  );
  const withFallbacks = appendUniqueQuestions(
    merged,
    options.fallbackQuestions,
    options.questionCount,
  );

  let fallbackCursor = 0;
  while (withFallbacks.length < options.questionCount) {
    const fallback =
      options.fallbackQuestions[
        fallbackCursor % options.fallbackQuestions.length
      ] ?? "이 글의 핵심 내용은 무엇인가요?";
    withFallbacks.push(normalizeKoreanQuestion(fallback) || fallback);
    fallbackCursor += 1;
  }

  return withFallbacks.slice(0, options.questionCount);
}
