import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { translateToEnglish } from "../openai";
import { procedure } from "../trpc-procedure";
import { LANG_CODES } from "./bulk-create-cards";

export const translateText = procedure
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
    await getUserSettings(ctx.user?.id);
    const result = await translateToEnglish(input.text, input.lang);
    return { result };
  });
