import { z } from "zod";
import { generateStructuredOutput } from "../ai";
import { LANG_CODES } from "../shared-types";
import { procedure } from "../trpc-procedure";
import { getLangName } from "../get-lang-name";

const inputSchema = z.object({
  langCode: LANG_CODES,
  contextText: z
    .string()
    .describe("The full text block where the words appeared."),
  wordsToDefine: z
    .array(z.string())
    .min(1)
    .describe("The specific words selected by the user."),
});

const DefinitionSchema = z.object({
  definitions: z
    .array(
      z.object({
        word: z.string().describe("The unknown word that was provided."),
        lemma: z
          .string()
          .nullable()
          .describe(
            "The dictionary form (lemma) of the word, or null if not applicable.",
          ),
        definition: z
          .string()
          .describe(
            "A concise definition of the word in English, suitable for a language learner, considering the context of the provided text.",
          ),
      }),
    )
    .describe("An array of definitions for the provided words."),
});

const outputSchema = DefinitionSchema;

export const defineUnknownWords = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }

    const { langCode, contextText, wordsToDefine } = input;
    const languageName = getLangName(langCode);

    const prompt = `Context (${languageName}):
${contextText}

---

Words to Define:
${wordsToDefine.join("\n")}

---

For each "Word to Define" listed above:
1. Provide its dictionary form (lemma) in ${languageName}. If the word is already in dictionary form or doesn't have one (like proper nouns), set lemma to null.
2. Provide a concise, simple English definition suitable for a language learner, considering its usage in the provided "Context". Focus on the most likely meaning in this context.
`;

    const response = await generateStructuredOutput({
      model: ["openai", "cheap"],
      messages: [{ role: "user", content: prompt }],
      schema: DefinitionSchema,
      maxTokens: 5000,
    });

    return response;
  });
