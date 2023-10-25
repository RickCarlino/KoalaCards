import { prismaClient } from "@/server/prisma-client";
import { gradePerformance } from "@/utils/srs";
import { Lang, transcribeB64 } from "@/utils/transcribe";
import { Card } from "@prisma/client";
import { z } from "zod";
import { procedure } from "../trpc";
import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat";

type CorrectQuiz = { correct: true };
type IncorrectQuiz = { correct: false; why: string };
type No = { yes: false; why: string };
type Yes = { yes: true; why: undefined };
type YesOrNo = Yes | No;
type Quiz = (
  transcript: string,
  card: Card,
) => Promise<CorrectQuiz | IncorrectQuiz>;

const YES_OR_NO = {
  name: "answer",
  parameters: {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
      response: {
        type: "string",
        description: "Answer to a yes or no question.",
        enum: ["yes", "no"],
      },
      why: {
        type: "string",
        description:
          "Explanation of your response. Only required if answer is 'no'",
      },
    },
    required: ["response"],
    dependencies: {
      response: {
        oneOf: [
          {
            properties: {
              response: { enum: ["yes"] },
            },
          },
          {
            properties: {
              response: { enum: ["no"] },
              why: { type: "string" },
            },
            required: ["why"],
          },
        ],
      },
    },
  },
};

const SYSTEM_PROMPT = `
You are an educational Korean learning app that teaches listening
and speaking. You must grade their quizzes. The user enters
text via speech-to-text and has no control over spacing or
punctuation (so don't worry about that). You must grade their
Word choice. It does not need to be an exact match, but it must
must be grammatically correct. Variations in word choice are
acceptable as long as the translation meaning is equivalent.
If they make a spelling mistake, you must treat it as a
pronunciation mistake.
`;

export const yesOrNo = async (input: string): Promise<YesOrNo> => {
  const content = input.replace(/^\s+/gm, "");
  console.log(content);
  const answer = await gptCall({
    messages: [
      { role: "user", content },
      { role: "system", content: SYSTEM_PROMPT },
    ],
    model: "gpt-3.5-turbo-0613",
    n: 4,
    temperature: 1.0,
    function_call: { name: "answer" },
    functions: [YES_OR_NO],
  });
  const result = answer.choices
    .map((x) => JSON.stringify(x.message?.function_call))
    .map((x) => JSON.parse(JSON.parse(x).arguments).why)
    .filter((x) => !!x);
  if (result.length > 1) {
    const why: string = result.join("\n\n");
    return { yes: false, why };
  }
  return { yes: true, why: undefined };
};

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

const gradeAndUpdateTimestamps = (card: Card, grade: number) => {
  const now = Date.now();

  return {
    firstReview: new Date(card.lastReview || now),
    lastReview: new Date(now),
    ...gradePerformance(card, grade, now),
  };
};

const markIncorrect = async (card: Card) => {
  await prismaClient.card.update({
    where: { id: card.id },
    data: gradeAndUpdateTimestamps(card, 0),
  });
};

const translationPrompt = (ko: string, transcript: string) => {
  return `
      TRANSLATION TEST:
      Prompt: <<${ko}>>.
      I said: <<${transcript}>>.
      ---
      Was I correct?`;
};

const markCorrect = async (card: Card) => {
  await prismaClient.card.update({
    where: { id: card.id },
    data: gradeAndUpdateTimestamps(card, 4),
  });
};

async function gradeResp(
  card: Card,
  whyIsItWrong: string | undefined,
): Promise<ReturnType<Quiz>> {
  if (whyIsItWrong) {
    await markIncorrect(card);
    return {
      correct: false,
      why: whyIsItWrong,
    };
  }
  await markCorrect(card);
  return {
    correct: true,
  };
}

async function dictationTest(transcript: string, card: Card) {
  if (transcript === card.term) {
    console.log("=== Exact match: " + card.term);
    return gradeResp(card, undefined);
  }
  const { why } = await yesOrNo(`
    REPEAT AFTER ME TEST:
    PROMPT: <<${card.term}>>
    I said: <<${transcript}>>
    ---
    Was I correct?`);
  return gradeResp(card, why);
}

async function listeningTest(transcript: string, card: Card) {
  const p = translationPrompt(card.term, transcript);
  const { why } = await yesOrNo(p);
  return gradeResp(card, why);
}

async function speakingTest(transcript: string, card: Card) {
  const { why } = await yesOrNo(`
     SPEAKING TEST:
     PROMPT: <<${card.definition}>>
     I said: <<${transcript}>>
     ---
     Was I correct?`);
  return gradeResp(card, why);
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
    result: z.literal("success"),
    userTranscription: z.string(),
  }),
  z.object({
    result: z.literal("failure"),
    userTranscription: z.string(),
    rejectionText: z.string(),
  }),
  z.object({
    result: z.literal("error"),
    rejectionText: z.string(),
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
  .mutation(async ({ input }): Promise<PerformExamOutput> => {
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
    const transcript = await transcribeB64(lang, input.audio);
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
    const result = card && (await quiz(transcript.text, card));
    if (!result) {
      console.log(`Invalid result: ${JSON.stringify(result)}`);
      return {
        result: "error",
        rejectionText: "Invalid result?",
      };
    }
    switch (result.correct) {
      case true:
        return {
          result: "success",
          userTranscription: transcript.text,
        } as const;
      case false:
        return {
          result: "failure",
          userTranscription: transcript.text,
          rejectionText: result.why,
        } as const;
      default:
        return {
          result: "error",
          rejectionText: "Invalid result?",
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
      markIncorrect(card);
    }
  });
