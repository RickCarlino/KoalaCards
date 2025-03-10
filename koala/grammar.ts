import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { openai } from "./openai";
import { prismaClient } from "./prisma-client";
import { QuizEvaluator } from "./quiz-evaluators/types";
import { getLangName } from "./get-lang-name";
import { LangCode } from "./shared-types";

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
  yesNo: z.enum(["yes", "no"]),
  why: z.string(),
});

const storeTrainingData: StoreTrainingData = async (props, exp) => {
  const { term, definition, langCode, userInput } = props;
  const { yesNo, why } = exp;

  await prismaClient.trainingData.create({
    data: {
      term,
      definition,
      langCode,
      userInput,
      yesNo,
      explanation: why,
      quizType: "speaking-v2-prompt",
      englishTranslation: "NA",
    },
  });
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
        `Translate ${props.term} to English.`,
      ].join(" "),
    },
    { role: "assistant" as const, content: props.definition },
    {
      role: "user" as const,
      content: [
        `Let's say I am in a situation that warrants the sentence above.`,
        `Could I say "${props.userInput}" instead?`,
        `Would that be OK? (I wrote this via speech recognition)`,
        override,
      ].join(" "),
    },
  ];
  const response = await openai.beta.chat.completions.parse({
    messages,
    model: "gpt-4o",
    temperature: 0.1,
    max_tokens: 1000,
    response_format: zodResponseFormat(zodGradeResponse, "grade_response"),
  });

  const gradeResponse = response.choices[0]?.message?.parsed;

  if (!gradeResponse) {
    throw new Error("Invalid response format from OpenAI.");
  }

  if (gradeResponse.yesNo === "no") {
    const resp2 = await openai.beta.chat.completions.parse({
      messages: [
        ...messages,
        {
          role: "assistant" as const,
          content: gradeResponse.why,
        },
        {
          role: "user" as const,
          content: [
            `Let's edit your response step by step:`,
            `1. Remove any 'mirroring' or repetition of my input. Just say "the original sentence" or "the provided sentence" if you need to.`,
            `2. We know the "orginal" sentence is correct - focus your discussion exclusively on the "provided" sentence.`,
            `3. We know the "provided" sentence is incorrect. Don't restate that fact - just explain "why" briefly.`,
            `4. Remove all pronounciation help - foreign words should only be written in the foreign writing system.`,
            `5. Shorten your response to one sentence in length.`,
            `6. Remove 'The provided sentence is incorrect because' from the start of your response.`,
            `7. Double check compliance with these rules before submitting your response.`,
          ].join("\n"),
        },
      ],
      model: "gpt-4o",
      store: true,
      temperature: 0.1,
    });
    const whyResponse = resp2.choices[0]?.message?.content;
    return {
      ...gradeResponse,
      why: whyResponse || gradeResponse.why,
    };
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

export const grammarCorrectionNext: QuizEvaluator = async ({
  userInput,
  card,
}) => {
  const chosen = await runAndStore({ ...card, userInput });
  console.log(JSON.stringify(chosen));
  if (chosen.yesNo === "yes") {
    return { result: "pass", userMessage: "" };
  } else {
    return {
      result: "fail",
      userMessage: chosen.why,
    };
  }
};
