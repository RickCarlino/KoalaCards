import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";

function guessLanguage(term: string, definition: string) {
  const output = { korean: "", english: "" };

  // Regex pattern to match Hangul characters
  const hangulPattern =
    /[\uAC00-\uD7A3\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF\u1160-\u11A7\uD7B0-\uD7C6]+/g;

  // Counting Hangul characters in the term and definition
  const termHangulCount = (term.match(hangulPattern) || []).join("").length;
  const definitionHangulCount = (definition.match(hangulPattern) || []).join(
    "",
  ).length;

  // Determining which one is Korean based on the count of Hangul characters
  if (termHangulCount > definitionHangulCount) {
    output.korean = term;
    output.english = definition;
  } else {
    output.korean = definition;
    output.english = term;
  }

  console.log(output);
  return output;
}

export const bulkCreateCards = procedure
  .input(
    z.object({
      input: z
        .array(
          z.object({
            term: z.string().max(1000),
            definition: z.string(),
          }),
        )
        .max(1000),
    }),
  )
  .output(
    z.array(
      z.object({
        term: z.string(),
        definition: z.string(),
      }),
    ),
  )
  .mutation(async ({ input, ctx }) => {
    const results: { term: string; definition: string }[] = [];
    for (const { term, definition } of input.input) {
      const { korean, english } = guessLanguage(term, definition);
      const userId = ctx.user?.id;
      if (userId) {
        const alreadyExists = await prismaClient.card.findFirst({
          where: {
            userId,
            term: korean,
          },
        });
        if (!alreadyExists) {
          await prismaClient.card.create({
            data: {
              userId,
              term: korean,
              definition: english,
            },
          });
          results.push({
            term: korean,
            definition: english,
          });
        } else {
          const ERR = "(Duplicate) ";
          results.push({
            term: ERR + korean,
            definition: ERR + english,
          });
        }
      }
    }
    return results;
  });
