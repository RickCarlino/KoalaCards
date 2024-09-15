import { z } from "zod";
import { procedure, router } from "../trpc-procedure";
import { bulkCreateCards } from "./bulk-create-cards";
import { deleteCard } from "./delete-card";
import { deleteFlaggedCards } from "./delete-flagged-card";
import { editCard } from "./edit-card";
import { editUserSettings } from "./edit-user-settings";
import { exportCards } from "./export-cards";
import { faucet } from "./faucet";
import { flagCard } from "./flag-card";
import { getAllCards } from "./get-all-cards";
import { getNextQuizzes } from "./get-next-quizzes";
import { getOneCard } from "./get-one-card";
import { getPlaybackAudio } from "./get-playback-audio";
import { getRadioItem } from "./get-radio-item";
import { gradeQuiz } from "./grade-quiz";
import { levelReviews } from "./level-reviews";
import { manuallyGrade } from "./manually-grade";
import { parseCards } from "./parse-cards";
import { rollbackGrade } from "./rollback-grade";
import { viewTrainingData } from "./view-training-data";
import { getUserSettings as gus } from "../auth-helpers";
import { transcribeB64 } from "../transcribe";
import { getUserSettings } from "./get-user-settings";
import { translateToEnglish } from "../openai";
import { speakText } from "../speak-text-ng";
import { draw } from "radash";

const LANG_CODES = z.union([z.literal("en-US"), z.literal("ko")]);

export const appRouter = router({
  bulkCreateCards,
  deleteCard,
  deleteFlaggedCards,
  editCard,
  editUserSettings,
  exportCards,
  faucet,
  flagCard,
  getAllCards,
  getNextQuizzes,
  getOneCard,
  getPlaybackAudio,
  getUserSettings,
  gradeQuiz,
  manuallyGrade,
  parseCards,
  rollbackGrade,
  levelReviews,
  getRadioItem,
  viewTrainingData,
  // === Experimental ===
  transcribeAudio: procedure
    .input(
      z.object({
        audio: z.string().max(1000000),
        lang: LANG_CODES,
      }),
    )
    .output(
      z.object({
        result: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const us = await gus(ctx.user?.id);
      const result = await transcribeB64(input.lang, input.audio, us.userId);
      console.log(JSON.stringify(result, null, 2));
      if (result.kind !== "OK") {
        return { result: "Error" };
      }

      return {
        result: result.text,
      };
    }),
  translateText: procedure
    .input(
      z.object({
        text: z.string().max(1000000),
        lang: LANG_CODES,
      }),
    )
    .output(
      z.object({
        result: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await gus(ctx.user?.id);
      const result = await translateToEnglish(input.text, input.lang);
      return { result };
    }),
  speakText: procedure
    .input(
      z.object({
        text: z.string().max(1000000),
        lang: LANG_CODES,
      }),
    )
    .output(
      z.object({
        url: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await gus(ctx.user?.id);
      const url = await speakText({
        text: input.text,
        langCode: input.lang,
        gender: draw(["F", "M", "N"] as const) || "N",
      });
      return { url };
    }),
});

export type AppRouter = typeof appRouter;
