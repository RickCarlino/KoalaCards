import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { procedure } from "../trpc-procedure";
import { clean } from "./turbine/util";
import { clusters } from "./turbine/cluster";
import { getLangName } from "../get-lang-name";

const TRANSLATION = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);

export const turbine = procedure
  .input(
    z.object({
      langCode: z.string(),
      words: z.string(),
    }),
  )
  .output(TRANSLATION)
  .mutation(async ({ ctx, input }) => {
    await getUserSettings(ctx.user?.id);
    const inputWords = clean(input.words.split(/[\s,]+/));
    return await clusters(inputWords, getLangName(input.langCode));
  });
