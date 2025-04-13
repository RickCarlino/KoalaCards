import { z } from 'zod';
import { procedure } from '../trpc-procedure';
import { LANG_CODES } from '../shared-types';
import { openai } from '../openai'; // Assuming this is the correct import path and interface

// Define a simple input schema for now, just the language code
const inputSchema = z.object({
  langCode: LANG_CODES,
  // TODO: Add topic, difficulty level later as per IDEA.md
});

// Define the output schema - an array of strings (the prompts)
const outputSchema = z.array(z.string());

export const generateWritingPrompts = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not found');
    }

    const { langCode } = input;

    // TODO: Refine the prompt engineering based on language and potential future inputs (topic, difficulty)
    const prompt = `Generate 5 short writing prompts for a language learner practicing ${langCode}. The prompts should be suitable for intermediate learners. Keep them concise and open-ended.`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Or potentially a newer/more suitable model
        messages: [{ role: 'user', content: prompt }],
        n: 1, // Generate one set of prompts
        // TODO: Consider adding max_tokens, temperature etc. for better control
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Failed to generate prompts from OpenAI');
      }

      // Assuming the LLM returns prompts separated by newlines
      const prompts = content.split('\n').map(p => p.trim()).filter(p => p.length > 0);

      // Basic validation or cleanup could be added here
      // For now, just return the split prompts

      return prompts;

    } catch (error) {
      console.error("Error generating writing prompts:", error);
      // Rethrow or handle specific errors as needed
      throw new Error('Failed to generate writing prompts');
    }
  });
