import { prismaClient } from "@/server/prisma-client";
import { gradePerformance } from "@/utils/srs";
import { Lang, transcribeB64 } from "@/utils/transcribe";
import { Card } from "@prisma/client";
import { z } from "zod";
import { procedure } from "../trpc";
import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat";
import { SafeCounter } from "@/utils/counter";

type Quiz = (
  transcript: string,
  card: Card,
) => Promise<[number, string | undefined]>;
const cleanString = (str: string) =>
  str.replace(/[^\w\s]|_/g, "").replace(/\s+/g, "");

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

const quizCompletion = SafeCounter({
  name: "quiz_completion",
  help: "Number of quiz attempts started",
  labelNames: ["result", "userID"],
});

const tokenUsage = SafeCounter({
  name: "token_usage",
  help: "Number of OpenAI tokens used",
  labelNames: ["userID"],
});

const GRADED_RESPONSE = {
  name: "grade_quiz",
  parameters: {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    title: "grade_quiz",
    required: ["grade"],
    properties: {
      grade: {
        type: "integer",
        minimum: 0,
        maximum: 5,
        description: "The grade given to the quiz, ranging from 0 to 5.",
      },
      explanation: {
        type: "string",
        description:
          "Explanation for why the grade was given. Only required for a grade of 3 or lower.",
      },
    },
    dependencies: {
      grade: {
        oneOf: [
          {
            properties: {
              grade: {
                type: "integer",
                enum: [4, 5],
              },
            },
          },
          {
            properties: {
              grade: {
                type: "integer",
                enum: [0, 1, 2, 3],
              },
            },
            required: ["explanation"],
          },
        ],
      },
    },
  },
};

const SYSTEM_PROMPT = `
You are an educational Korean learning app.
You grade speaking, listening and dictation drills provided
by students.

Please provide the following grades for quizzes:
  Grade 0 - WRONG User said "I don't know" or gave up.
  Grade 1 - WRONG User tried to answer, but was very wrong.
  Grade 2 - WRONG Most words are correct, but conveys a different meaning.
  Grade 3 - MOSTLY CORRECT Expresses correct meaning, but is awkward or unnatural.
  Grade 4 - CORRECT Correct except for spelling, punctuation, pronoun usage.
  Grade 5 - CORRECT Perfectly correct.

Remember:
 * If the user says "I don't know" or similar, always grade 0.
 * If the sentence is completely different than the provided sentence, always grade 0.
`;

export const gradedResponse = async (
  input: string,
  userID: string | number,
): Promise<[number, string | undefined]> => {
  const content = input.replace(/^\s+/gm, "");
  console.log(content);
  const answer = await gptCall({
    messages: [
      { role: "user", content },
      { role: "system", content: SYSTEM_PROMPT },
    ],
    model: "gpt-3.5-turbo-0613",
    n: 2,
    temperature: 1.0,
    function_call: { name: "grade_quiz" },
    functions: [GRADED_RESPONSE],
  });
  if (!answer) {
    throw new Error("No answer");
  }
  tokenUsage.labels({ userID }).inc(answer.usage?.total_tokens ?? 0);
  const results = answer.choices
    .map((x) => JSON.stringify(x.message?.function_call))
    .map((x) => JSON.parse(JSON.parse(x).arguments))
    .filter((x) => !!x)
    .map((x) => x as { grade: number; explanation?: string })
    .map((x) => [x.grade, x.explanation] as const);
  const avg = results.reduce((acc, [grade]) => acc + grade, 0) / results.length;
  let expl: string | undefined = undefined;
  for (const [, value] of results) {
    if (value !== undefined) {
      expl = value;
      break;
    }
  }
  const TIPPING_POINT = 0.1; // A grade of exactly 3.0 should be marked wrong.
  console.log([...results, [avg, expl]].map((x) => x.join(" / ")).join("\n"));
  return [avg - TIPPING_POINT, expl];
};

const gradeAndUpdateTimestamps = (card: Card, grade: number) => {
  const now = Date.now();

  return {
    firstReview: new Date(card.lastReview || now),
    lastReview: new Date(now),
    ...gradePerformance(card, grade, now),
  };
};

const setGrade = async (card: Card, grade: number) => {
  await prismaClient.card.update({
    where: { id: card.id },
    data: gradeAndUpdateTimestamps(card, grade),
  });
};

const translationPrompt = (term: string, transcript: string) => {
  return `
      TRANSLATION TEST
      I was asked to translate the following sentence to English:
      <<${term}>>.
      I said:
      <<${transcript}>>.
      ---
      Was I correct?`;
};

async function gradeResp(
  card: Card,
  grade: number,
  whyIsItWrong: string | undefined,
): Promise<ReturnType<Quiz>> {
  await setGrade(card, grade);
  return [grade, whyIsItWrong];
}

async function dictationTest(transcript: string, card: Card) {
  if (cleanString(transcript) === cleanString(card.term)) {
    console.log("=== Exact match: " + card.term);
    return gradeResp(card, 5, undefined);
  }
  const [grade, why] = await gradedResponse(
    `
    REPEAT AFTER ME TEST:
    The system asked me to say: 
    <<${card.term}>>
    I said:
    <<${transcript}>>
    ---
    Was I correct?`,
    card.userId,
  );
  return gradeResp(card, grade, why);
}

async function listeningTest(transcript: string, card: Card) {
  const p = translationPrompt(card.term, transcript);
  const [grade, why] = await gradedResponse(p, card.userId);
  return gradeResp(card, grade, why);
}

async function speakingTest(transcript: string, card: Card) {
  const [grade, why] = await gradedResponse(
    `
     SPEAKING TEST:
     I was asked to translate the following sentence to the target language:
     <<${card.definition}>>
     I said:
     <<${transcript}>>
     ---
     Was I correct?`,
    card.userId,
  );
  return gradeResp(card, grade, why);
}

const lessonType = z.union([
  z.literal("dictation"),
  z.literal("listening"),
  z.literal("speaking"),
]);

export const openai = new OpenAI(configuration);

export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  return await openai.chat.completions.create(opts);
}

const performExamOutput = z.union([
  z.object({
    grade: z.number(),
    userTranscription: z.string(),
    result: z.literal("success"),
  }),
  z.object({
    grade: z.number(),
    rejectionText: z.string(),
    userTranscription: z.string(),
    result: z.literal("failure"),
  }),
  z.object({
    rejectionText: z.string(),
    result: z.literal("error"),
  }),
]);

type PerformExamOutput = z.infer<typeof performExamOutput>;

export const performExam = procedure
  .input(
    z.object({
      lessonType,
      audio: z.string(),
      id: z.number(),
    }),
  )
  .output(performExamOutput)
  .mutation(async ({ input, ctx }): Promise<PerformExamOutput> => {
    type LessonType = typeof input.lessonType;
    const LANG: Record<LessonType, Lang> = {
      dictation: "ko",
      listening: "en-US",
      speaking: "ko",
    };
    const QUIZ: Record<LessonType, Quiz> = {
      dictation: dictationTest,
      listening: listeningTest,
      speaking: speakingTest,
    };
    const lang = LANG[input.lessonType];
    const quiz = QUIZ[input.lessonType];
    const transcript = await transcribeB64(
      lang,
      input.audio,
      ctx.user?.id ?? 0,
    );
    const card = await prismaClient.card.findUnique({
      where: { id: input.id },
    });
    if (transcript.kind === "error") {
      console.log(`Transcription error`);
      return {
        result: "error",
        rejectionText: "Transcription error",
      } as const;
    }
    const [grade, reason] = card
      ? await quiz(transcript.text, card)
      : [0, "Error"];
    const userID = ctx.user?.id;
    if (grade < 3) {
      quizCompletion.labels({ result: "failure", userID }).inc();
      return {
        result: "failure",
        userTranscription: transcript.text,
        rejectionText: reason || "Unknown reason",
        grade,
      } as const;
    } else {
      quizCompletion.labels({ result: "success", userID }).inc();
      return {
        result: "success",
        userTranscription: transcript.text,
        grade,
      } as const;
    }
  });

export const failPhrase = procedure
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .mutation(async ({ input }) => {
    const card = await prismaClient.card.findFirst({
      where: { id: input.id },
    });
    if (card) {
      setGrade(card, 0);
    }
  });
