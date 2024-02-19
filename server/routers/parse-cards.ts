import { createCardsFromText } from "@/utils/create-cards-from-text";
import { z } from "zod";
import { procedure } from "../trpc";

export const parseCards = procedure
  .input(
    z.object({
      text: z.string().max(3000),
    }),
  )
  .output(
    z.object({
      cards: z.array(
        z.object({
          definition: z.string(),
          term: z.string(),
        }),
      ),
    }),
  )
  .mutation(async ({ input }) => {
    try {
      const cards = await createCardsFromText(input.text);
      return { cards };
    } catch (error) {
      console.error(error);
      throw new Error("Failed to parse cards");
    }
  });
