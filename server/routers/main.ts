import { prismaClient } from "@/server/prisma-client";
import { Lang, transcribeB64 } from "@/utils/transcribe";
import { Phrase } from "@prisma/client";
import {
  Configuration,
  CreateChatCompletionRequest,
  CreateCompletionRequest,
  OpenAIApi,
} from "openai";
import { z } from "zod";
import { procedure, router } from "../trpc";
import getLessons from "@/utils/fetch-lesson";
import { randomNew } from "@/experimental/random-new";

const PROMPT_CONFIG = { best_of: 2, temperature: 0.4 };

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = new Configuration({ apiKey });
export const openai = new OpenAIApi(configuration);

type AskOpts = Partial<CreateCompletionRequest>;

export async function askRaw(opts: CreateChatCompletionRequest) {
  return await openai.createChatCompletion(opts);
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
  return resp.data.choices
    .filter((x) => x.finish_reason === "stop")
    .map((x) => x.message?.content ?? "");
}

const cleanYesNo = (answer?: string) => {
  return (answer ?? "?")
    .replace(/(\s|\W)+/g, " ")
    .trim()
    .toUpperCase()
    .split(" ")[0];
};

const translationPrompt = (ko: string, response: string) => {
  return `
    A Korean language learning app user was asked to translate
    the following phrase to english: ${ko}.
    The user provided this translation: ${response}
    Was the user correct?
    spacing and punctuation mistakes are acceptable.
    The meanings of the two sentences must express the exact same idea.
    Punctuation and word choice do not need to be exact.
    Reply "YES" if it is a correct translation.
    Reply "NO" if it is incorrect, then provide a display
    reason for why it is wrong
    `;
};

const NEXT_QUIZ_TYPES: Record<string, string | undefined> = {
  dictation: "listening",
  listening: "speaking",
  speaking: "listening",
};

const markIncorrect = async (phrase: Phrase) => {
  await prismaClient.phrase.update({
    where: { id: phrase.id },
    data: {
      loss_count: { increment: 1 },
      total_attempts: { increment: 1 },
      win_percentage: phrase.win_count / (phrase.total_attempts + 1),
      last_win_at: undefined,
      next_quiz_type: "dictation",
    },
  });
};

const markCorrect = async (phrase: Phrase) => {
  /** Increase `win_count`, `total_attempts`.
    Recalculate `win_percentage`.
    Set last `last_win_at` to current time.
    Calculate next value of `next_quiz_type` based
    on the following table:

    | Previous Val  | Next Val      |
    |---------------|---------------|
    | "dictation"   | "listening"   |
    | "listening"   | "speaking"    |
    | All others    | "dictation"   | */
  await prismaClient.phrase.update({
    where: { id: phrase.id },
    data: {
      win_count: { increment: 1 },
      total_attempts: { increment: 1 },
      win_percentage: (phrase.win_count + 1) / (phrase.total_attempts + 1),
      last_win_at: { set: new Date() },
      next_quiz_type:
        NEXT_QUIZ_TYPES[phrase.next_quiz_type ?? "dictation"] ?? "dictation",
    },
  });
};

async function gradeResp(answer: string = "", phrase: Phrase) {
  const cleanAnswer = cleanYesNo(answer);
  switch (cleanAnswer) {
    case "YES":
      await markCorrect(phrase);
      return true;
    case "NO":
      console.log(answer);
      await markIncorrect(phrase);
      return false;
    default:
      throw new Error("Invalid answer: " + JSON.stringify(answer));
  }
}

async function dictationTest(transcript: string, phrase: Phrase) {
  const [answer] = await ask(
    `
  A Korean language learning app user was asked to read the
  following phrase aloud: ${phrase.ko} (${phrase.en}).
  The user read: ${transcript}
  Was the user correct?
  spacing and punctuation mistakes are acceptable.
  The meanings of the two sentences must express the exact same idea.
  Punctuation and word choice do not need to be exact.
  Reply "YES" if it is correct.
  Reply "NO" if it is incorrect, then provide a display reason
  why it is wrong
  (YES/NO)
  `,
    PROMPT_CONFIG
  );
  return gradeResp(answer, phrase);
}

async function listeningTest(transcript: string, phrase: Phrase) {
  const p = translationPrompt(phrase.ko, transcript);
  const [answer] = await ask(p, PROMPT_CONFIG);
  return gradeResp(answer, phrase);
}

async function speakingTest(transcript: string, phrase: Phrase) {
  const [answer] = await ask(
    `An English-speaking Korean language learning app user was asked
    to translate the following phrase to Korean: ${phrase.en} (${phrase.ko}).
    The user said: ${transcript}
    Was the user correct?
    spacing and punctuation mistakes are acceptable.
    The meanings of the two sentences must express the exact same idea.
    Punctuation and word choice do not need to be exact.
    Reply "YES" if it is correct.
    Reply "NO" if it is incorrect, then provide a reason why it is wrong
    `,
    PROMPT_CONFIG
  );
  return gradeResp(answer, phrase);
}

const quizType = z.union([
  z.literal("dictation"),
  z.literal("listening"),
  z.literal("speaking"),
]);

export const appRouter = router({
  /** The `faucet` route is a mutation that returns a "Hello, world" string
   * and takes an empty object as its only argument. */
  faucet: procedure
    .input(z.object({}))
    .output(z.object({ message: z.string() }))
    .mutation(async () => {
      const phrase = await randomNew();
      return { message: JSON.stringify(phrase, null, 2) };
    }),
  getAllPhrases: procedure
    .input(z.object({}))
    .output(
      z.array(
        z.object({
          id: z.number(),
          en: z.string(),
          ko: z.string(),
          win_percentage: z.number(),
          total_attempts: z.number(),
          flagged: z.boolean(),
        })
      )
    )
    .query(async ({ ctx }) => {
      return await prismaClient.phrase.findMany({
        where: { userId: ctx.user?.id || "000" },
        orderBy: { total_attempts: "desc" },
      });
    }),
  editPhrase: procedure
    .input(
      z.object({
        id: z.optional(z.number()),
        en: z.optional(z.string()),
        ko: z.optional(z.string()),
        flagged: z.optional(z.boolean()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const phrase = await prismaClient.phrase.findFirst({
        where: {
          id: input.id,
          userId: ctx.user?.id || "000",
        },
      });
      if (!phrase) {
        throw new Error("Phrase not found");
      }
      await prismaClient.phrase.update({
        where: { id: phrase.id },
        data: {
          en: input.en ?? phrase.en,
          ko: input.ko ?? phrase.ko,
          flagged: input.flagged ?? false,
        },
      });
    }),
  getOnePhrase: procedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .output(
      z.object({
        id: z.number(),
        en: z.string(),
        ko: z.string(),
        win_percentage: z.number(),
        total_attempts: z.number(),
        flagged: z.boolean(),
      })
    )
    .query(async ({ input, ctx }) => {
      const phrase = await prismaClient.phrase.findFirst({
        where: {
          id: input.id,
          userId: ctx.user?.id || "000",
        },
      });
      if (!phrase) {
        throw new Error("Phrase not found");
      }
      return phrase;
    }),
  failPhrase: procedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const phrase = await prismaClient.phrase.findFirst({
        where: { id: input.id },
      });
      if (phrase) {
        markIncorrect(phrase);
      }
    }),
  flagPhrase: procedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const phrase = await prismaClient.phrase.findFirst({
        where: {
          id: input.id,
          userId: ctx.user?.id || "0",
        },
      });
      if (phrase) {
        await prismaClient.phrase.update({
          where: { id: phrase.id },
          data: {
            flagged: true,
          },
        });
      }
    }),
  getNextQuizzes: procedure
    .input(z.object({}))
    .output(
      z.array(
        z.object({
          id: z.number(),
          en: z.string(),
          ko: z.string(),
          quizType,
          quizAudio: z.string(),
          win_percentage: z.number(),
          total_attempts: z.number(),
        })
      )
    )
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("User not found");
      }
      await maybeCreatePhraseForUser(userId);
      return await getLessons(userId);
    }),
  performExam: procedure
    .input(
      z.object({
        /** quizType represents what type of quiz was administered.
         * It is one of the following values:
         * "dictation", "listening", "speaking" */
        quizType,
        audio: z.string(),
        id: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      type Quiz = typeof speakingTest;
      type QuizType = typeof input.quizType;
      const LANG: Record<QuizType, Lang> = {
        dictation: "ko",
        listening: "en-US",
        speaking: "ko",
      };
      const QUIZ: Record<QuizType, Quiz> = {
        dictation: dictationTest,
        listening: listeningTest,
        speaking: speakingTest,
      };
      const lang = LANG[input.quizType];
      const quiz = QUIZ[input.quizType];
      const transcript = await transcribeB64(lang, input.audio);
      const phrase = await prismaClient.phrase.findUnique({
        where: { id: input.id },
      });
      if (transcript.kind === "error") {
        console.log(`Transcription error`);
        return { result: "error" } as const;
      }
      const result = phrase && (await quiz(transcript.text, phrase));
      switch (result) {
        case true:
          return { result: "success" } as const;
        case false:
          return { result: "failure" } as const;
        default:
          return { result: "error" } as const;
      }
    }),
});
// export type definition of API
export type AppRouter = typeof appRouter;
async function maybeCreatePhraseForUser(userId: string) {
  const count = await prismaClient.phrase.count({
    where: {
      flagged: false,
      userId,
      total_attempts: 0,
    },
  });

  if (count < 3) {
    let newPhrase = await randomNew();
    await prismaClient.phrase.create({
      data: {
        ko: newPhrase.ko,
        en: newPhrase.en,
        userId,
      },
    });
    console.log("Created new phrase:");
    console.log(JSON.stringify(newPhrase, null, 2));
  }
}
