import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getLangName } from "./get-lang-name";
import { openai } from "./openai";
import { prismaClient } from "./prisma-client";
import { compare } from "./quiz-evaluators/evaluator-utils";
import { QuizEvaluator } from "./quiz-evaluators/types";

export type Explanation = z.infer<typeof zodGradeResponse>;

type GrammarCorrectionProps = {
  term: string; // Prompt term
  definition: string; // Example correct answer
  langCode: string;
  userInput: string;
};

type StoreTrainingData = (
  props: GrammarCorrectionProps,
  exp: Explanation,
) => Promise<void>;

const zodGradeResponse = z.object({
  grade: z.enum(["ok", "edit"]),
  correctedSentence: z.string().optional(),
});

const storeTrainingData: StoreTrainingData = async (props, exp) => {
  const { term, definition, langCode, userInput } = props;
  const { grade, correctedSentence } = exp;

  const yesNo = grade === "ok" ? "yes" : "no";

  await prismaClient.trainingData.create({
    data: {
      term,
      definition,
      langCode,
      userInput,
      yesNo,
      explanation: correctedSentence || "",
      quizType: "speaking",
      englishTranslation: "NA",
    },
  });
};

function systemPrompt() {
  return [
    "=== GRAMMAR ERROR DETECTION ===",
    "=== FOCUS: LEARNER MISTAKES ONLY ===",
    "Your task: Identify and correct ONLY common language learner grammatical errors.",
    "DO NOT suggest improvements to:",
    "- Vocabulary choice/phrasing",
    "- Style/nuance",
    "- Regional variations",
    "- Naturalness of expression",
    "ONLY correct these specific error types:",
    "Korean: Particle errors (은/는 vs 이/가), incorrect verb endings",
    "Japanese: Particle errors (は vs が), verb conjugation mistakes",
    "Spanish: Gender agreement errors, ser/estar confusion",
    "Evaluation rules:",
    "1. If sentence is grammatically correct → RESPOND WITH 'OK'",
    "2. If contains learner mistake from listed categories → EDIT (minimal changes)",
    "3. If error not in listed categories → 'OK' even if non-ideal",
    "4. Preserve user's original words when possible",
    "Critical constraints:",
    "- NEVER add suggestions/comments",
    "- NEVER correct valid regional variations",
    "- NEVER edit stylistically different but grammatically correct sentences",
    "Examples:",
    "- User: 'Él está ingeniero' → 'Él es ingeniero' (ser/estar EDIT)",
    "- User: 'Watashi wa gakusei desu' → OK (correct particles)",
    "- User: 'She eat rice' → 'She eats rice' (verb conjugation EDIT)",
    "- User: 'I consumed breakfast' → OK (different phrasing but correct)",
    "Output ONLY 'OK' or edited sentence with minimal corrections.",
  ].join("\n");
}

async function run(props: GrammarCorrectionProps): Promise<Explanation> {
  const messages = [
    {
      role: "user" as const,
      content: systemPrompt(),
    },
    {
      role: "user" as const,
      content: [
        `Language: ${getLangName(props.langCode)}`,
        `Student Prompt: "${props.definition}"`,
        `Student Response: "${props.userInput}"`,
      ].join("\n"),
    },
  ];

  const response = await openai.beta.chat.completions.parse({
    messages,
    model: "gpt-4o",
    max_tokens: 125,
    temperature: 0.1,
    response_format: zodResponseFormat(zodGradeResponse, "grade_response"),
  });

  const gradeResponse = response.choices[0]?.message?.parsed;
  if (!gradeResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }

  if (
    gradeResponse.correctedSentence &&
    compare(props.userInput, gradeResponse.correctedSentence, 0)
  ) {
    gradeResponse.grade = "ok";
    delete gradeResponse.correctedSentence;
  }

  return gradeResponse;
}

async function runAndStore(
  props: GrammarCorrectionProps,
): Promise<Explanation> {
  const result = await run(props);
  storeTrainingData(props, result);
  return result;
}

export const grammarCorrection: QuizEvaluator = async ({ userInput, card }) => {
  const chosen = await runAndStore({ ...card, userInput });

  if (chosen.grade === "ok") {
    return { result: "pass", userMessage: "" };
  } else {
    // "edit"
    return {
      result: "fail",
      userMessage: `✏️${chosen.correctedSentence || ""}`,
    };
  }
};
