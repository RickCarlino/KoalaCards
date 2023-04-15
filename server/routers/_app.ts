import { z } from "zod";
import { procedure, router } from "../trpc";
import { dataURItoBlob } from "@/utils/from-data-url";
import { prismaClient } from "@/old_src/prisma-client";
console.log(process.env.DATABASE_URL ?? "? NO UL");
export const appRouter = router({
  getNextPhrase: procedure
    .input(z.object({}))
    .output(z.object({
      id: z.number(),
      en: z.string(),
      ko: z.string(),
      win_percentage: z.number(),
    }))
    .mutation(async () => {
      // SELECT * FROM Phrase ORDER BY win_percentage ASC, total_attempts ASC;
      const phrase = await prismaClient.phrase.findFirst({
        orderBy: [{ win_percentage: "asc" }, { total_attempts: "asc" }],
      });
      if (phrase) {
        return {
          id: phrase.id,
          en: phrase.en ?? 'wow',
          ko: phrase.ko ?? 'nooo',
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
        audio: z.any(),
        phraseID: z.number(),
      })
    )
    .mutation(async (params) => {
      console.log(dataURItoBlob(params.input.audio));
      debugger;
      return {
        result: "success",
        score: 100,
      };
    }),
});
// export type definition of API
export type AppRouter = typeof appRouter;
