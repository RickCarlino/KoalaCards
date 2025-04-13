import { z } from 'zod';
import { openai } from '../openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { LangCode, LANG_CODES } from '../shared-types'; // Import LangCode type
import { procedure } from '../trpc-procedure';
import { getLangName } from '../get-lang-name';

// Updated Input schema: context text, words to define, and language code
const inputSchema = z.object({
  langCode: LANG_CODES,
  contextText: z.string().describe("The full text block where the words appeared."),
  wordsToDefine: z.array(z.string()).min(1).describe("The specific words selected by the user."),
});

// Updated Zod schema for the expected structured output from OpenAI
const DefinitionSchema = z.object({
  definitions: z.array(z.object({
    word: z.string().describe("The unknown word that was provided."),
    lemma: z.string().optional().describe("The dictionary form (lemma) of the word, if applicable."),
    definition: z.string().describe("A concise definition of the word in English, suitable for a language learner, considering the context of the provided text."),
  })).describe("An array of definitions for the provided words."),
});

// Output schema for the tRPC route - includes lemma now
const outputSchema = DefinitionSchema;

export const defineUnknownWords = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not found');
    }

    // Use the new input fields
    const { langCode, contextText, wordsToDefine } = input;
    const languageName = getLangName(langCode);

    // No need for the marker check anymore, input schema ensures wordsToDefine is not empty

    // Updated prompt asking for definitions and lemmas, context might be essay or prompt
    const prompt = `Context (${languageName}):
${contextText}

---

Words to Define:
${wordsToDefine.join('\n')}

---

For each "Word to Define" listed above:
1. Provide its dictionary form (lemma) in ${languageName}. If the word is already in dictionary form or doesn't have one (like proper nouns), you can omit the lemma or repeat the word.
2. Provide a concise, simple English definition suitable for a language learner, considering its usage in the provided "Context". Focus on the most likely meaning in this context.
`;

    try {
      const completion = await openai.beta.chat.completions.parse({
        model: "gpt-4o", // Or a model suitable for definitions
        messages: [{ role: "user", content: prompt }],
        n: 1,
        response_format: zodResponseFormat(DefinitionSchema, "word_definitions"),
        temperature: 0.3, // Lower temperature for more factual definitions
      });

      const parsedResponse = completion.choices[0]?.message?.parsed;

      if (!parsedResponse) {
        console.error("Invalid or missing parsed response from OpenAI for definitions:", completion.choices[0]?.message);
        throw new Error("Failed to get structured definitions from OpenAI");
      }

      // Return the structured definitions
      return parsedResponse;

    } catch (error) {
      console.error("Error generating definitions:", error);
      throw new Error("Failed to generate definitions for unknown words");
    }
  });
