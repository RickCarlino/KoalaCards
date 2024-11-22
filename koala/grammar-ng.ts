import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources";
import { errorReport } from "./error-report";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "./prisma-client";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

export const openai = new OpenAI(configuration);

export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  return await openai.chat.completions.create(opts);
}

const zodGradeResponse = z.object({
  grade: z.enum(["correct", "grammar", "incorrect"]),
  correctedSentence: z.string().optional(),
});

export type Explanation = {
  grade: "correct" | "grammar" | "incorrect";
  correctedSentence?: string;
};

type GrammarCorrectionProps = {
  /** The target phrase. */
  term: string;
  /** An English translation */
  definition: string;
  /** Language code like KO */
  langCode: string;
  /** What the user said. */
  userInput: string;
};

const getLangName = (lang: string) => {
  const names: Record<string, string> = {
    EN: "English",
    IT: "Italian",
    FR: "French",
    ES: "Spanish",
    KO: "Korean",
  };
  const key = lang.slice(0, 2).toUpperCase();
  return names[key] || lang;
};

async function getCache(
  props: GrammarCorrectionProps,
): Promise<Explanation | undefined> {
  const td = await prismaClient.trainingData.findFirst({
    where: {
      term: props.term,
      definition: props.definition,
      langCode: props.langCode,
      userInput: props.userInput,
    },
  });

  if (td) {
    const correctedSentence = td.explanation || "";
    // Pencil emoji means it's a grammar correction.
    if (correctedSentence.includes("✏️")) {
      return {
        grade: "grammar",
        correctedSentence: `✏️${correctedSentence} (Repeat Mistake)`,
      };
    }
    return {
      grade: td.yesNo === "yes" ? "correct" : "incorrect",
      correctedSentence,
    };
  }
}

async function setCache(
  props: GrammarCorrectionProps,
  explanation: Explanation,
) {
  await prismaClient.trainingData.create({
    data: {
      term: props.term,
      definition: props.definition,
      langCode: props.langCode,
      userInput: props.userInput,
      yesNo: explanation.grade === "correct" ? "yes" : "no",
      explanation: "grammar-ng",
      quizType: "speaking",
      englishTranslation: "NA",
    },
  });
}

export const grammarCorrectionNG = async (
  props: GrammarCorrectionProps,
): Promise<Explanation> => {
  const cached = await getCache(props);
  if (cached) {
    return cached;
  }
  const model = "gpt-4o-2024-08-06";
  const { userInput, definition } = props;
  const lang = getLangName(props.langCode);
  const prompt = [
    `You are a language learning assistant.`,
    `You asked the user to say "${definition}" in ${lang}.`,
    `They responded with: "${userInput}".`,
    `Evaluate the user's response according to the following criteria:`,
    `1. Correct: The sentence is correct (or close enough) both in its grammar usage and target meaning.`,
    `2. Grammar: The student said a correct sentence, but it has minor grammar issues. In this case, provide a mild correction in the 'correctedSentence' field.`,
    `3. Incorrect: The meaning of the sentence is not the same, or there are major grammar problems. Write a SHORT explanation of the problem.`,
    `Your response should be a JSON object with the following structure:`,
    `For Correct: { "grade": "correct" }`,
    `For Grammar: { "grade": "grammar", "correctedSentence": "..." }`,
    `For Incorrect: { "grade": "incorrect" }`,
    `Do not include any explanations or additional text.`,
  ].join("\n");

  const resp = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    model,
    max_tokens: 125,
    temperature: 0.1,
    response_format: zodResponseFormat(zodGradeResponse, "grade_response"),
  });

  const grade_response = resp.choices[0].message.parsed;

  if (grade_response) {
    setCache(props, grade_response);
    return grade_response;
  } else {
    return {
      grade: "incorrect",
      correctedSentence: "This should never happen. Submit a bug report.",
    };
  }
};
