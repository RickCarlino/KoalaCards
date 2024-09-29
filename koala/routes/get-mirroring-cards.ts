import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { generateLessonAudio } from "../speech";
import { map } from "radash";

export const getMirrorCards = procedure
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        id: z.number(),
        term: z.string(),
        definition: z.string(),
        audioUrl: z.string(),
        langCode: z.string(),
      }),
    ),
  )
  .mutation(async ({ ctx }) => {
    const cards = await prismaClient.card.findMany({
      where: { userId: ctx.user?.id || "000", flagged: false },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });
    // Order by length of 'term' field:
    cards.sort((a, b) => a.term.length - b.term.length);
    return await map(cards.slice(0, 50), async (card) => {
      return {
        id: card.id,
        term: card.term,
        definition: card.definition,
        langCode: card.langCode,
        audioUrl: await generateLessonAudio({
          card,
          lessonType: "listening",
        }),
      };
    });
  });
