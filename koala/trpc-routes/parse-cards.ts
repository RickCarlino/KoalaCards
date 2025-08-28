import { createCardsFromText } from "@/koala/create-cards-from-text";
import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { LANG_CODES } from "../shared-types";

export const parseCards = procedure
  .input(
    z.object({
      langCode: LANG_CODES,
      text: z.string().max(3000),
    }),
  )
  .output(
    z.object({
      cards: z.array(
        z.object({
          definition: z.string(),
          term: z.string(),
          gender: z.enum(["M", "F", "N"]),
        }),
      ),
    }),
  )
  .mutation(async ({ input }) => {
    const cards = await createCardsFromText(input.langCode, input.text);
    return { cards };
  });
