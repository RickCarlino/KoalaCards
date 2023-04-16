import { z } from "zod";
import { procedure, router } from "../trpc";
import { prismaClient } from "@/old_src/prisma-client";
import { transcribeB64 } from "@/utils/transcribe";
import { en, ko, pause, ssml } from "@/utils/ssml";
import { speak } from "@/old_src/utils/speak";

export const appRouter = router({
  speak: procedure
    .input(
      z.object({
        text: z.array(
          z.union([
            z.object({ kind: z.literal("ko"), value: z.string() }),
            z.object({ kind: z.literal("en"), value: z.string() }),
            z.object({ kind: z.literal("pause"), value: z.number() }),
          ])
        ),
      })
    )
    .mutation(async ({ input }) => {
      const ssmlBody = input.text.map((item) => {
        switch (item.kind) {
          case "ko":
            return ko(item.value);
          case "en":
            return en(item.value);
          case "pause":
            return pause(item.value);
        }
      });
      await speak(ssml(...ssmlBody));
    }),
  getNextPhrase: procedure
    .input(z.object({}))
    .output(
      z.object({
        id: z.number(),
        en: z.string(),
        ko: z.string(),
        win_percentage: z.number(),
      })
    )
    .mutation(async () => {
      // SELECT * FROM Phrase ORDER BY win_percentage ASC, total_attempts ASC;
      const phrase = await prismaClient.phrase.findFirst({
        orderBy: [{ win_percentage: "asc" }, { total_attempts: "asc" }],
      });
      if (phrase) {
        return {
          id: phrase.id,
          en: phrase.en ?? "",
          ko: phrase.ko ?? "",
          win_percentage: phrase.win_percentage,
        };
      } else {
        return {
          id: 0,
          en: "You must add more phrases",
          ko: "더 많은 문장을 추가해야 합니다.",
          win_percentage: 0,
        };
      }
    }),
  performExam: procedure
    .input(
      z.object({
        /** quizType represents what type of quiz was administered.
         * It is one of the following values:
         * "dictation", "listening", "speaking" */
        quizType: z.union([
          z.literal("dictation"),
          z.literal("listening"),
          z.literal("speaking"),
        ]),
        audio: z.string(),
        id: z.number(),
      })
    )
    .mutation(async (params) => {
      switch (params.input.quizType) {
        case "dictation":
        case "speaking":
          console.log(await transcribeB64("ko", params.input.audio));
          break;
        case "listening":
          console.log(await transcribeB64("en-US", params.input.audio));
          break;
      }
      return { result: "success" };
    }),
});
// export type definition of API
export type AppRouter = typeof appRouter;
