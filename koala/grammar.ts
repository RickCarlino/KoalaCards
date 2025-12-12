import { z } from "zod";
import { generateStructuredOutput } from "./ai";
import { prismaClient } from "./prisma-client";
import type { Prisma } from "@prisma/client";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { getLangName } from "./get-lang-name";
import { LangCode } from "./shared-types";

const TARGET_LANG: LangCode = "ko";

const ERROR_TAGS = [
  "ok",
  "form",
  "input-error",
  "syntax",
  "lexis",
  "semantics",
  "pragmatics",
  "orthography",
  "unnatural",
  "better-option",
] as const;

type ErrorTag = (typeof ERROR_TAGS)[number];

const TAG_DESCRIPTIONS: Record<ErrorTag, string> = {
  ok: "No issues; a native speaker would accept this",
  "better-option":
    "Understandable, but a clearer or more natural alternative exists",
  "input-error":
    "Transcription artifact: STT glitch, typo, spacing, or diacritics",
  pragmatics: "Register, politeness, tone, or discourse use is off",
  orthography:
    "Spelling, spacing, capitalization, diacritics, or punctuation issue",
  form: "Morphology/inflection/agreement/derivation is incorrect",
  syntax: "Word order or construction/valency is incorrect",
  lexis:
    "Wrong word choice, irrelevant word choice, bad collocation, or false friend",
  semantics: "Meaning is inaccurate, ambiguous, or misleading",
  unnatural: "Grammatically fine but not idiomatic or natural",
};

const DOWNVOTE_TAGS = new Set<ErrorTag>([
  "ok",
  "input-error",
  "better-option",
  "pragmatics",
  "orthography",
]);

const DEFAULT_EVENT_TYPE = "speaking-judgement";

const tagSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.number().int(),
        tag: z.enum(ERROR_TAGS),
      }),
    )
    .max(12),
});

const zodGradeResponse = z.object({
  yesNo: z.enum(["yes", "no"]),
  why: z.string(),
});

type Explanation = z.infer<typeof zodGradeResponse>;

type QuizResultEntry = {
  id: number;
  definition: string;
  userInput: string;
};

type GrammarCorrectionProps = {
  term: string;
  definition: string;
  userInput: string;
  userId: string;
  eventType?: string;
};

type StoreTrainingData = (
  props: GrammarCorrectionProps,
  exp: Explanation,
) => Promise<number>;

const tagDescriptionsBlock = Object.entries(TAG_DESCRIPTIONS)
  .map(([k, v]) => `\`${k}\`: ${v}.`)
  .join("\n");

const buildTaggingMessages = (entries: QuizResultEntry[]) => {
  const entriesBlock = entries
    .map((r) =>
      [
        `id=${r.id}`,
        `lang=${TARGET_LANG}`,
        `teacherQuestion=${r.definition}`,
        `studentResponse=${r.userInput}`,
        `---`,
      ].join("\n"),
    )
    .join("\n");

  const system = {
    role: "system" as const,
    content: `
You are a language-learning error classifier.

Task:
- For each entry, assign exactly one error tag from the allowed list.
- Tags: ${ERROR_TAGS.join(", ")}.
- Use the tag that best explains why the userInput is wrong compared to the acceptableTerm.
- If the userInput is already natural and acceptable, use "ok".
- Return only valid JSON matching the schema provided (no extra text).

Be concise, consistent, and deterministic.
`.trim(),
  };

  const user = {
    role: "user" as const,
    content: [
      "Return JSON: { items: [{ id, tag }] }.",
      `Tags enum: ${ERROR_TAGS.join(", ")}.`,
      "Tag descriptions:",
      tagDescriptionsBlock,
      "Entries:",
      "```",
      entriesBlock,
      "```",
    ].join("\n\n"),
  };

  return [system, user];
};

async function addTagsToList() {
  const untaggedWhere: Prisma.QuizResultWhereInput = {
    isAcceptable: false,
    OR: [{ errorTag: null }, { errorTag: "" }],
  };

  const candidates = await prismaClient.quizResult.findMany({
    where: untaggedWhere,
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  if (!candidates.length) {
    return;
  }

  const messages = buildTaggingMessages(candidates);
  const structured = await generateStructuredOutput({
    model: ["openai", "cheap"],
    messages,
    schema: tagSchema,
    maxTokens: 3000,
  });

  if (!structured.items.length) {
    return;
  }

  const updates = structured.items.map((item) => {
    const where: Prisma.QuizResultWhereInput = {
      id: item.id,
      isAcceptable: false,
      OR: [{ errorTag: null }, { errorTag: "" }],
    };
    const data: Prisma.QuizResultUpdateManyMutationInput = {
      errorTag: item.tag,
      ...(DOWNVOTE_TAGS.has(item.tag) ? { helpfulness: -1 } : {}),
    };
    return prismaClient.quizResult.updateMany({ where, data });
  });

  await Promise.all(updates);
}

const storeTrainingData: StoreTrainingData = async (props, exp) => {
  const { term, definition, userInput, userId, eventType } = props;
  const { yesNo, why } = exp;
  void addTagsToList();
  const created = await prismaClient.quizResult.create({
    data: {
      userId,
      acceptableTerm: term,
      definition,
      userInput,
      isAcceptable: yesNo === "yes",
      reason: why,
      eventType: eventType ?? DEFAULT_EVENT_TYPE,
    },
  });

  return created.id;
};

const LANG_OVERRIDES: Partial<Record<LangCode, string>> = {
  [TARGET_LANG]:
    "For the sake of this discussion, let's say that formality levels don't need to be taken into consideration.",
};

async function run(props: GrammarCorrectionProps): Promise<Explanation> {
  const override = LANG_OVERRIDES[TARGET_LANG] ?? "";
  const messages = [
    {
      role: "user" as const,
      content: [
        `I am learning ${getLangName(TARGET_LANG)}.`,
        `My prompt was: ${props.definition} (${props.term})`,
        `Let's say I am in a situation that warrants the sentence or prompt above.`,
        `Could one say "${props.userInput}"?`,
        `Would that be OK?`,
        `(entered via speech-to-text, I have no control over spacing or punctuation so please focus on the content.)`,
        override,
        `Explain in one tweet or less.`,
      ].join(" "),
    },
  ];
  const gradeResponse = await generateStructuredOutput({
    model: ["openai", "cheap"],
    messages,
    schema: zodGradeResponse,
  });

  return gradeResponse;
}

async function runAndStore(
  props: GrammarCorrectionProps,
): Promise<{ explanation: Explanation; quizResultId: number }> {
  const result = await run(props);
  const id = await storeTrainingData(props, result);
  return { explanation: result, quizResultId: id };
}

export const grammarCorrectionNext: QuizEvaluator = async ({
  userInput,
  card,
  userID,
}) => {
  const { explanation, quizResultId } = await runAndStore({
    ...card,
    userInput,
    userId: userID,
    eventType: DEFAULT_EVENT_TYPE,
  });
  const result = explanation.yesNo === "yes" ? "pass" : "fail";
  return { result, userMessage: explanation.why, quizResultId };
};

export async function gradeUtterance(params: {
  term: string;
  definition: string;
  userInput: string;
  userId: string;
  eventType?: string;
}): Promise<{
  isCorrect: boolean;
  feedback: string;
  quizResultId: number;
}> {
  const { explanation, quizResultId } = await runAndStore({
    term: params.term,
    definition: params.definition,
    userInput: params.userInput,
    userId: params.userId,
    eventType: params.eventType ?? DEFAULT_EVENT_TYPE,
  });
  return {
    isCorrect: explanation.yesNo === "yes",
    feedback: explanation.why,
    quizResultId,
  };
}
