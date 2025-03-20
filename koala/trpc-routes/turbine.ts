import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { procedure } from "../trpc-procedure";
// import { categorizeWords } from "./turbine/categorize";
// import { pairColocations } from "./turbine/colocations";
// import { generatePhrases } from "./turbine/phrases";
// import { translateObject } from "./turbine/translate-objects";
// import { translatePhrases } from "./turbine/translate-phrases";
import { clean } from "./turbine/util";
import { clusters } from "./turbine/cluster";

const TRANSLATION = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);

// const processWords = async (step1: string[]) => {
//   const step2 = await pairColocations(step1);
//   const step3 = await generatePhrases(step2);
//   const step4 = await translatePhrases(step3);
//   return step4;
// };

// async function version1(inputWords: string[]) {
//   const categories = await categorizeWords(inputWords);
//   const x = await Promise.all([
//     processWords(categories.words),
//     translateObject(categories.objects),
//     translatePhrases(categories.misc),
//   ]);
//   return x.flat();
// }

// function version2(inputWords: string[]) {
//   // TODO
//   return [];
// }

export const turbine = procedure
  .input(
    z.object({
      words: z.string(),
    }),
  )
  .output(TRANSLATION)
  .mutation(async ({ ctx, input }) => {
    await getUserSettings(ctx.user?.id);
    const inputWords = clean(input.words.split(/[\s,]+/));
    return await clusters(inputWords);
  });
