import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { generateLessonAudio } from "../speech";
import { map, shuffle } from "radash";

export const getMirrorCards = procedure
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        id: z.number(),
        term: z.string(),
        definition: z.string(),
        audioUrl: z.string(),
        translationAudioUrl: z.string(),
        langCode: z.string(),
      }),
    ),
  )
  .mutation(async ({ ctx }) => {
    const cards = await prismaClient.card.findMany({
      where: { userId: ctx.user?.id || "000", flagged: false },
      orderBy: [{ mirrorRepetitionCount: "asc" }],
      take: 200,
    });
    // Order by length of 'term' field:
    cards.sort((a, b) => b.term.length - a.term.length);
    const shortList = shuffle(cards.slice(0, 100)).slice(0, 5);
    return await map(shortList, async (card) => {
      return {
        id: card.id,
        term: card.term,
        definition: card.definition,
        langCode: card.langCode,
        translationAudioUrl: await generateLessonAudio({
          card,
          lessonType: "speaking",
        }),
        audioUrl: await generateLessonAudio({
          card,
          lessonType: "listening",
        }),
      };
    });
  });
