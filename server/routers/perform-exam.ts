import { prismaClient } from "@/server/prisma-client";
import { gradePerformance } from "@/utils/srs";
import { Lang, transcribeB64 } from "@/utils/transcribe";
import { Card } from "@prisma/client";
import { z } from "zod";
import { procedure } from "../trpc";
import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat";

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
          "Explanation of your response, directed to I. Only required if answer is 'no'",
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

export const yesOrNo = async (content: string): Promise<YesOrNo> => {
  const answer = await askRaw({
    messages: [{ role: "user", content }],
    model: "gpt-3.5-turbo-0613",
    n: 3,
    temperature: 1.0,
    function_call: { name: "answer" },
    functions: [YES_OR_NO],
  });
  const result = answer.choices
    .map((x) => JSON.stringify(x.message?.function_call))
    .map((x) => JSON.parse(JSON.parse(x).arguments).why)
    .filter((x) => !!x);
  const why: string = result[0];
  const yes = typeof why !== "string";
  return yes ? { yes: true, why: undefined } : { yes: false, why };
};
type AskOpts = Partial<ChatCompletionCreateParamsNonStreaming>;
type CorrectQuiz = { correct: true };
type IncorrectQuiz = { correct: false; why: string };
type No = { yes: false; why: string };
type Yes = { yes: true; why: undefined };
type YesOrNo = Yes | No;
type Quiz = (
  transcript: string,
  card: Card,
) => Promise<CorrectQuiz | IncorrectQuiz>;

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

const translationPrompt = (ko: string, response: string) => {
  return `
      Korean phrase: <<${ko}>>.
      I said: <<${response}>>.
      ---
      A Korean language learning app asked me to translate the
      phrase above. Tell me if I was correct. The audio was
      transcribed via speech-to-text, so DO NOT grade punctuation
      or spacing issues. The meanings of the two sentences must
      express the same idea, but word choice does not need to
      be exact. Meaning is more important.`;
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
  const { why } = await yesOrNo(`
    Phrase: <<${card.term}>>
    Translation: <<${card.definition}>>
    I said: <<${transcript}>>
    ---
    I was asked to read the above phrase aloud. Was I correct?
    The audio was transcribed via speech-to-text so you should
    NOT grade  punctuation or spacing issues. Word choice does
    not need to be exact (focus on meaning).`);
  return gradeResp(card, why);
}

async function listeningTest(transcript: string, card: Card) {
  const p = translationPrompt(card.term, transcript);
  const { why } = await yesOrNo(p);
  return gradeResp(card, why);
}

async function speakingTest(transcript: string, card: Card) {
  const { why } = await yesOrNo(
    `Phrase: <<${card.definition}>>
     I said: <<${transcript}>>
     ---
      A Korean language learning app asked me to say the English
      phrase above in Korean. Was I correct? The audio was
      transcribed via speech-to-text, so DO NOT grade punctuation
      or spacing. The meanings of the two sentences must
      express the same idea, but the word choice does NOT need
      to be exactly the same. The only way I can be wrong is
      if the meaning does not match the phrase.`,
  );
  return gradeResp(card, why);
}

const lessonType = z.union([
  z.literal("dictation"),
  z.literal("listening"),
  z.literal("speaking"),
]);

export const openai = new OpenAI(configuration);

export async function askRaw(opts: ChatCompletionCreateParamsNonStreaming) {
  return await openai.chat.completions.create(opts);
}

export async function ask(prompt: string, opts: AskOpts = {}) {
  const resp = await askRaw({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: opts.temperature ?? 0.15,
    max_tokens: opts.max_tokens ?? 1024,
    n: opts.n ?? 1,
  });
  return resp.choices
    .filter((x) => x.finish_reason === "stop")
    .map((x) => x.message?.content ?? "");
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
