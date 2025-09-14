import { z } from "zod";
import { generateStructuredOutput } from "./ai";
import { prismaClient } from "./prisma-client";
import type { Prisma } from "@prisma/client";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { getLangName } from "./get-lang-name";
import { LangCode } from "./shared-types";

type Explanation = z.infer<typeof zodGradeResponse>;

type GrammarCorrectionProps = {
  term: string; // Prompt term
  definition: string; // Example correct answer
  langCode: string;
  userInput: string;
  userId: string;
  eventType?: string;
};

type StoreTrainingData = (
  props: GrammarCorrectionProps,
  exp: Explanation,
) => Promise<number>;

const zodGradeResponse = z.object({
  yesNo: z.enum(["yes", "no"]),
  why: z.string(),
});

async function addTagsToList() {
  console.log("tagging untagged quiz results");
  const ERROR_TAGS = [
    "ok",            // no issues, a native speaker would say this
    "form",          // morphology, inflection, agreement, derivation
    "input-error",   // speech-to-text glitch, typo, spacing, accent usage, transcription slip
    "syntax",        // word order, constructions, valency, sentence structure
    "lexis",         // wrong word, collocation, false friend, sense mismatch
    "semantics",     // meaning inaccurate, ambiguous, misleading
    "pragmatics",    // register, politeness, tone, discourse use
    "orthography",   // spelling, spacing, diacritics, capitalization, punctuation
    "unnatural",     // grammatically fine but not idiomatic
    "better-option"  // understandable, but a clearer/more natural alternative exists
  ] as const;

  // Error tags are constrained by the enum above via Zod.

  // 1) Pull a small batch of candidates (limit 10) that failed.
  // Note: We deliberately do not filter by errorTag here to avoid type drift issues
  // if the Prisma client hasn't been regenerated yet. We gate updates below instead.
  const untaggedWhere: Prisma.QuizResultWhereInput = {
    isAcceptable: false,
    OR: [{ errorTag: null }, { errorTag: "" }],
  };

  const candidates = await prismaClient.quizResult.findMany({
    where: untaggedWhere,
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  if (candidates.length === 0) return;

  // 2) Ask the model to assign a tag per id, using structured output constrained to ERROR_TAGS
  const ZItem = z.object({ id: z.number().int(), tag: z.enum(ERROR_TAGS) });
  const ZOut = z.object({ items: z.array(ZItem).max(10) });

  const toTag = candidates;
  const system = {
    role: "system" as const,
    content: `????`,
  };
  const TAG_DESCRIPTIONS: Record<(typeof ERROR_TAGS)[number], string> = {
    ok: "No issues; a native speaker would accept this",
    "better-option": "Understandable, but a clearer or more natural alternative exists",
    "input-error": "Transcription artifact: STT glitch, typo, spacing, or diacritics",
    pragmatics: "Register, politeness, tone, or discourse use is off",
    orthography: "Spelling, spacing, capitalization, diacritics, or punctuation issue",
    form: "Morphology/inflection/agreement/derivation is incorrect",
    syntax: "Word order or construction/valency is incorrect",
    lexis: "Wrong word choice, collocation, or false friend",
    semantics: "Meaning is inaccurate, ambiguous, or misleading",
    unnatural: "Grammatically fine but not idiomatic or natural",
  };

  const tagDescriptionsBlock = Object.entries(TAG_DESCRIPTIONS)
    .map(([k, v]) => `\`${k}\`: ${v}.`)
    .join("\n");

  const entriesBlock = toTag
    .map(
      (r) =>
        [
          `id=${r.id}`,
          `lang=${r.langCode}`,
          `teacherQuestion=${r.definition}`,
          `studentResponse=${r.userInput}`,
          `---`,
        ].join("\n"),
    )
    .join("\n");

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

  const structured = await generateStructuredOutput({
    model: ["openai", "fast"],
    messages: [system, user],
    schema: ZOut,
    maxTokens: 300,
  });

  if (!structured.items.length) return;
  console.log(JSON.stringify([system, user, structured], null, 2));
  // 3) Apply tags; only set tag if it's currently null/empty to avoid overwriting
  const DOWNVOTE_TAGS = new Set(["ok", "input-error", "better-option", "pragmatics", "orthography"]);
  const updates = structured.items.map((it) => {
    const where: Prisma.QuizResultWhereInput = {
      id: it.id,
      isAcceptable: false,
      OR: [{ errorTag: null }, { errorTag: "" }],
    };
    const data: Prisma.QuizResultUpdateManyMutationInput = {
      errorTag: it.tag,
      ...(DOWNVOTE_TAGS.has(it.tag) ? { helpfulness: -1 } : {}),
    };
    return prismaClient.quizResult.updateMany({ where, data });
  });

  await Promise.all(updates);
}

const storeTrainingData: StoreTrainingData = async (props, exp) => {
  const { term, definition, langCode, userInput, userId, eventType } =
    props;
  const { yesNo, why } = exp;
  void addTagsToList();
  const created = await prismaClient.quizResult.create({
    data: {
      userId,
      acceptableTerm: term,
      definition,
      langCode,
      userInput,
      isAcceptable: yesNo === "yes",
      // reason field mapped from the model; store under reason
      reason: why,
      eventType: eventType || "speaking-judgement",
    },
  });

  return created.id;
};

const LANG_OVERRIDES: Partial<Record<LangCode, string>> = {
  ko: "For the sake of this discussion, let's say that formality levels don't need to be taken into consideration.",
};

async function run(props: GrammarCorrectionProps): Promise<Explanation> {
  const override = LANG_OVERRIDES[props.langCode as LangCode] || "";
  const messages = [
    {
      role: "user" as const,
      content: [
        `I am learning ${getLangName(props.langCode)}.`,
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
    eventType: "speaking-judgement",
  });
  console.log(JSON.stringify(explanation));
  if (explanation.yesNo === "yes") {
    return { result: "pass", userMessage: explanation.why, quizResultId };
  } else {
    return {
      result: "fail",
      userMessage: explanation.why,
      quizResultId,
    };
  }
};

export async function gradeUtterance(params: {
  term: string;
  definition: string;
  langCode: LangCode | string;
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
    langCode: String(params.langCode),
    userInput: params.userInput,
    userId: params.userId,
    eventType: params.eventType || "speaking-judgement",
  });
  return {
    isCorrect: explanation.yesNo === "yes",
    feedback: explanation.why,
    quizResultId,
  };
}
