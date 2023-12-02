import { prismaClient } from "@/server/prisma-client";
import { gradePerformance } from "@/utils/srs";
import { Lang, transcribeB64 } from "@/utils/transcribe";
import { Card } from "@prisma/client";
import { z } from "zod";
import { superUsers, procedure } from "../trpc";
import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat";
import { SafeCounter } from "@/utils/counter";
import { exactMatch } from "@/utils/clean-string";
import { errorReport } from "@/utils/error-report";
let approvedUserIDs: string[] = [];
prismaClient.user.findMany({}).then((users) => {
  users.map(({ email, id }) => {
    if (!email) {
      console.log("=== No email for user " + id);
      return;
    }
    if (superUsers.includes(email)) {
      console.log(`=== Super user: ${email} / ${id}`);
      approvedUserIDs.push(id);
    } else {
      console.log(`=== Normal user: ${email} / ${id}`);
    }
  });
});

type Quiz = (
  transcript: string,
  card: Card,
) => Promise<[number, string | undefined]>;
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
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

// const apiTimeout = SafeCounter({
//   name: "api_timeout",
//   help: "Number of OpenAI API timeouts",
//   labelNames: ["userID"],
// });

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
        maximum: 3,
        description: "The grade given to the quiz, ranging from 0 to 3.",
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
                enum: [2, 3],
              },
            },
          },
          {
            properties: {
              grade: {
                type: "integer",
                enum: [0, 1],
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
Grading Scale:

Grade 0: WRONG
- User gave up.
- Unrelated meaning.
- Opposite meaning.

Grade 1: WRONG
- The sentence has a different meaning from the original.
- Only give this grade if the meaning is very wrong.

Grade 2: CORRECT (minor mistakes)
- The meaning is spot on, but there are small errors like spelling,
  punctuation, or incorrect pronoun usage.

Grade 3: PERFECT
- The sentence matches the expected meaning and form.

---

As an educational Korean learning tool, you grade student's
speaking, listening, and dictation drills.

You will be given two things:

1. A prompt, which the student must translate.
2. The student's response to the prompt.

Using the correct answer as a guide and also the grading scale above,
grade the student's response.

After you write your response, double check that you graded
correctly.

Do not nit pick word order or small details. The goal is to asses the student's
ability to express ideas and understand sentences.
`;

export const gradedResponse = async (
  input: string,
  userID: string | number,
): Promise<[number, string | undefined]> => {
  userID = userID || "";
  const useGPT4 = approvedUserIDs.includes("" + userID);
  let model = useGPT4 ? "gpt-4-1106-preview" : "gpt-3.5-turbo-1106";
  if (input.includes("REPEAT AFTER ME TEST")) {
    model = "gpt-3.5-turbo-1106"; // Don't waste money on dictation tests.
  }
  const content = input.replace(/^\s+/gm, "");
  const answer = await gptCall({
    messages: [
      { role: "user", content },
      { role: "system", content: SYSTEM_PROMPT },
    ],
    model,
    n: 1,
    temperature: useGPT4 ? 0.75 : 0,
    function_call: { name: "grade_quiz" },
    functions: [GRADED_RESPONSE],
    max_tokens: 555,
  });
  if (!answer) {
    return errorReport("No answer");
  }
  tokenUsage.labels({ userID }).inc(answer.usage?.total_tokens ?? 0);
  type Result = [number, string | undefined];
  const results: Result[] = answer.choices
    .map((x) => JSON.stringify(x.message?.function_call))
    .map((x) => JSON.parse(JSON.parse(x).arguments))
    .filter((x) => !!x)
    .map((x) => x as { grade: number; explanation?: string })
    .map((x): Result => [x.grade, x.explanation]);
  // sort results by 0th element.
  // Grab median value:
  const median = results[0][0]; //.sort((a, b) => a[0] - b[0])[1][0];
  const jitter = Math.random() * 0.4;
  const result = median + jitter;
  const explanation = results[0][1] ?? "No explanation";
  const scaled = (result / 3) * 5;
  const capped = Math.min(scaled, 5);
  console.log("\n" + `#`.repeat(20));
  console.log(content);
  // Add some jitter to the score
  // to prevent scheduling pileups when
  // the user crams many cards at one time.
  console.log(model + " " + [result, scaled, explanation].join(" => "));
  console.log(answer.usage || "No usage data");
  return [capped, explanation];
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
      ${term}.
      I said:
      ${transcript}.
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
  if (exactMatch(transcript, card.term)) {
    return gradeResp(card, 5, undefined);
  }
  const [grade, why] = await gradedResponse(
    `
    REPEAT AFTER ME TEST:
    The system asked me to say:
    ${card.term}
    I said:
    ${transcript}
    ---
    Was I correct?`,
    card.userId,
  );
  return gradeResp(card, grade, why);
}

async function listeningTest(transcript: string, card: Card) {
  if (exactMatch(transcript, card.definition)) {
    return gradeResp(card, 5, undefined);
  }
  const p = translationPrompt(card.term, transcript);
  const [grade, why] = await gradedResponse(p, card.userId);
  return gradeResp(card, grade, why);
}

async function speakingTest(transcript: string, card: Card) {
  if (exactMatch(transcript, card.term)) {
    return gradeResp(card, 5, undefined);
  }

  const [grade, why] = await gradedResponse(
    `
     SPEAKING TEST:
     I was asked to translate the following sentence to the target language:
     ${card.definition}
     I said:
     ${transcript}
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

// function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
//   let done = false;
//   const timeoutPromise = new Promise<T>((_resolve, reject) => {
//     setTimeout(() => {
//       if (!done) {
//         apiTimeout.inc();
//         reject(new Error("Operation timed out"));
//       }
//     }, timeoutMs);
//   });

//   return Promise.race([promise, timeoutPromise]);
// }

export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  // return withTimeout(openai.chat.completions.create(opts), 11000);
  return openai.chat.completions.create(opts);
}

const performExamOutput = z.union([
  z.object({
    grade: z.number(),
    userTranscription: z.string(),
    result: z.literal("success"),
  }),
  z.object({
    // ADD previousSpacingData HERE
    previousSpacingData: z.object({
      repetitions: z.number(),
      interval: z.number(),
      ease: z.number(),
      lapses: z.number(),
    }),
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
      audio: z.string().max(800000), // 15 seconds max
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
    const userID = ctx.user?.id;
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
      return {
        result: "error",
        rejectionText: "Transcription error",
      } as const;
    }
    if (!card) {
      console.log(`Card not found`);
      return {
        result: "error",
        rejectionText: "Card not found",
      } as const;
    }
    const previousSpacingData = {
      repetitions: card.repetitions,
      interval: card.interval,
      ease: card.ease,
      lapses: card.lapses,
    };
    const [grade, reason] = card
      ? await quiz(transcript.text.slice(0, 80), card)
      : [0, "Error"];
    if (lang == "ko") {
      prismaClient.transcript
        .create({
          data: {
            value: transcript.text,
            cardId: card.id,
            grade,
          },
        })
        .then(() => {});
    }
    if (grade < 3) {
      quizCompletion.labels({ result: "failure", userID }).inc();
      return {
        result: "failure",
        userTranscription: transcript.text,
        rejectionText: reason || "Unknown reason",
        grade,
        previousSpacingData,
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

export const failCard = procedure
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
