import { prismaClient } from "@/server/prisma-client";
import { Lang, transcribeB64 } from "@/utils/transcribe";
import { Card, Phrase } from "@prisma/client";
import {
  Configuration,
  CreateChatCompletionRequest,
  CreateCompletionRequest,
  OpenAIApi,
} from "openai";
import { z } from "zod";
import { procedure, router } from "../trpc";
import getLessons from "@/utils/fetch-lesson";
import { ingestOne, ingestPhrases } from "@/utils/ingest-phrases";
import { phraseFromUserInput, randomNew } from "@/utils/random-new";

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
  console.log(prompt);
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
    The audio was transcribed so you should NOT grade spelling, punctuation or spacing issues.
    The meanings of the two sentences must express the exact same idea.
    Word choice does not need to be exact. Meaning is more important.
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

const markIncorrect = async (card: Card) => {
  await prismaClient.card.update({
    where: { id: card.id },
    data: {
      loss_count: { increment: 1 },
      total_attempts: { increment: 1 },
      win_percentage: card.win_count / (card.total_attempts + 1),
      last_win_at: undefined,
      next_quiz_type: "dictation",
    },
  });
};

const markCorrect = async (card: Card) => {
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
  await prismaClient.card.update({
    where: { id: card.id },
    data: {
      win_count: { increment: 1 },
      total_attempts: { increment: 1 },
      win_percentage: (card.win_count + 1) / (card.total_attempts + 1),
      last_win_at: { set: new Date() },
      next_quiz_type:
        NEXT_QUIZ_TYPES[card.next_quiz_type ?? "dictation"] ?? "dictation",
    },
  });
};

async function gradeResp(answer: string = "", card: Card & { phrase: Phrase }) {
  const cleanAnswer = cleanYesNo(answer);
  switch (cleanAnswer) {
    case "YES":
      await markCorrect(card);
      return true;
    case "NO":
      console.log(answer);
      await markIncorrect(card);
      return false;
    default:
      throw new Error("Invalid answer: " + JSON.stringify(answer));
  }
}

async function dictationTest(
  transcript: string,
  card: Card & { phrase: Phrase },
) {
  const [answer] = await ask(
    `
  A Korean language learning app user was asked to read the
  following phrase aloud: ${card.phrase.term} (${card.phrase.definition}).
  The user read: ${transcript}
  Was the user correct?
  The meanings of the two sentences must express the exact same idea.
  The audio was transcribed so you should NOT grade spelling, punctuation or spacing issues.
  Word choice do not need to be exact.
  Reply "YES" if it is correct.
  Reply "NO" if it is incorrect, then provide a display reason
  why it is wrong
  (YES/NO)
  `,
    PROMPT_CONFIG,
  );
  return gradeResp(answer, card);
}

async function listeningTest(
  transcript: string,
  card: Card & { phrase: Phrase },
) {
  const p = translationPrompt(card.phrase.term, transcript);
  const [answer] = await ask(p, PROMPT_CONFIG);
  return gradeResp(answer, card);
}

async function speakingTest(
  transcript: string,
  card: Card & { phrase: Phrase },
) {
  const [answer] = await ask(
    `An English-speaking Korean language learning app user was asked
    to translate the following phrase to Korean: ${card.phrase.definition} (${card.phrase.term}).
    The user said: ${transcript}
    Was the user correct?
    The audio was transcribed so you should NOT grade spelling, punctuation or spacing issues.
    The meanings of the two sentences must express the exact same idea.
    The word choice does NOT need to be exactly the same.
    Reply "YES" if it is correct.
    Reply "NO" if it is incorrect, then provide a reason why it is wrong
    `,
    PROMPT_CONFIG,
  );
  return gradeResp(answer, card);
}

const quizType = z.union([
  z.literal("dictation"),
  z.literal("listening"),
  z.literal("speaking"),
]);

prismaClient.phrase.count().then((any) => {
  if (!any) {
    console.log("New database detected...");
    ingestPhrases();
  }
});

export const appRouter = router({
  /** The `faucet` route is a mutation that returns a "Hello, world" string
   * and takes an empty object as its only argument. */
  faucet: procedure
    .input(z.object({}))
    .output(z.object({ message: z.string() }))
    .mutation(async () => {
      const card = await randomNew();
      return { message: JSON.stringify(card, null, 2) };
    }),
  importPhrases: procedure
    .input(
      z.object({
        input: z.array(
          z.object({
            term: z.string(),
            definition: z.string(),
          }),
        ),
      }),
    )
    .output(
      z.array(
        z.object({
          ko: z.string(),
          en: z.string(),
          input: z.string(),
        }),
      ),
    )
    .mutation(async ({ input, ctx }) => {
      const results: { ko: string; en: string; input: string }[] = [];
      for (const { term, definition } of input.input) {
        const result = await phraseFromUserInput(term, definition);
        const userId = ctx.user?.id;
        if (result && userId) {
          const phrase = await ingestOne(result.ko, result.en);
          if (phrase) {
            await prismaClient.card.create({
              data: {
                userId,
                phraseId: phrase.id,
                next_quiz_type: "dictation",
              },
            });
            results.push({
              ko: result.ko,
              en: result.en,
              input: term,
            });
          }
        }
      }
      return results;
    }),
  getAllPhrases: procedure
    .input(z.object({}))
    .output(
      z.array(
        z.object({
          id: z.number(),
          win_percentage: z.number(),
          total_attempts: z.number(),
          flagged: z.boolean(),
          phrase: z.object({
            id: z.number(),
            term: z.string(),
            definition: z.string(),
          }),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      return await prismaClient.card.findMany({
        include: { phrase: true },
        where: { userId: ctx.user?.id || "000" },
        orderBy: { total_attempts: "desc" },
      });
    }),
  deleteCard: procedure
    .input(
      z.object({
        id: z.optional(z.number()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("User not found");
      }

      const card = await prismaClient.card.findFirst({
        where: {
          id: input.id,
          userId,
        },
      });

      if (!card) {
        throw new Error("Card not found");
      }

      await prismaClient.card.delete({
        where: { id: card.id },
      });
    }),
  editCard: procedure
    .input(
      z.object({
        id: z.optional(z.number()),
        en: z.optional(z.string()),
        ko: z.optional(z.string()),
        flagged: z.optional(z.boolean()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("User not found");
      }

      const card = await prismaClient.card.findFirst({
        where: {
          id: input.id,
          userId,
        },
      });

      if (!card) {
        throw new Error("Card not found");
      }

      await prismaClient.card.update({
        where: { id: card.id },
        data: {
          flagged: input.flagged ?? false,
        },
      });
    }),
  getOneCard: procedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .output(
      z.object({
        id: z.number(),
        en: z.string(),
        ko: z.string(),
        win_percentage: z.number(),
        total_attempts: z.number(),
        flagged: z.boolean(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const card = await prismaClient.card.findFirst({
        where: {
          id: input.id,
          userId: ctx.user?.id || "000",
        },
      });
      if (!card) {
        throw new Error("Card not found");
      }
      const phrase = await prismaClient.phrase.findFirst({
        where: { id: card.phraseId },
      });
      if (!phrase) {
        throw new Error("Phrase not found");
      }
      return {
        ...card,
        en: phrase.definition,
        ko: phrase.term,
      };
    }),
  failPhrase: procedure
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
    }),
  flagPhrase: procedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const card = await prismaClient.card.findFirst({
        where: {
          id: input.id,
          userId: ctx.user?.id || "0",
        },
      });
      if (card) {
        await prismaClient.card.update({
          where: { id: card.id },
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
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("User not found");
      }
      await maybeAddPhraseForUser(userId);
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
      }),
    )
    .output(
      z.union([
        z.object({
          result: z.literal("success"),
          message: z.string(),
        }),
        z.object({
          result: z.literal("failure"),
          message: z.string(),
        }),
        z.object({
          result: z.literal("error"),
          message: z.string(),
        }),
      ]),
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
      const card = await prismaClient.card.findUnique({
        include: { phrase: true },
        where: { id: input.id },
      });
      if (transcript.kind === "error") {
        console.log(`Transcription error`);
        return {
          result: "error",
          message: "Transcription error",
        } as const;
      }
      const result = card && (await quiz(transcript.text, card));
      switch (result) {
        case true:
          return {
            result: "success",
            message: transcript.text,
          } as const;
        case false:
          return {
            result: "failure",
            message: transcript.text,
          } as const;
        default:
          return {
            result: "error",
            message: "Invalid result?",
          } as const;
      }
    }),
});

// export type definition of API
export type AppRouter = typeof appRouter;
async function maybeAddPhraseForUser(userId: string) {
  const count = await prismaClient.card.count({
    where: {
      flagged: false,
      userId,
      total_attempts: 0,
    },
  });

  if (count < 3) {
    const ids = (await prismaClient.$queryRawUnsafe(
      // DO NOT pass in or accept user input here
      `SELECT id FROM Phrase ORDER BY RANDOM() LIMIT 10;`,
    )) as { id: number }[];
    // Select 20 random phrases from phrase table:
    const phrases = await prismaClient.phrase.findMany({
      where: {
        id: { in: ids.map((x) => x.id) },
      },
    });
    // Insert them into the card table:
    for (const phrase of phrases) {
      await prismaClient.card.create({
        data: {
          userId,
          phraseId: phrase.id,
          next_quiz_type: "dictation",
        },
      });
    }
  }
}
