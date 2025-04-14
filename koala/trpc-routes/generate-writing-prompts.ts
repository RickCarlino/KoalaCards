import { shuffle, unique } from "radash";
import { z } from "zod";
import { getLangName } from "../get-lang-name";
import { openai } from "../openai";
import { prismaClient } from "../prisma-client";
import { LANG_CODES } from "../shared-types";
import { procedure } from "../trpc-procedure";

// Define a simple input schema for now, just the language code
const inputSchema = z.object({
  langCode: LANG_CODES,
  // TODO: Add topic, difficulty level later as per IDEA.md
});

// Zod schema for the expected structured output from OpenAI
// const PromptSchema = z.object({
//   prompts: z.array(z.string()),
// });

// Define the tRPC output schema - still an array of strings
const outputSchema = z.array(z.string());

export const generateWritingPrompts = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }

    const { langCode } = input;

    // Get last 1000 quiz IDs, sorted by lastReview (most recent first), unique by cardId
    const cardIDs = (
      await prismaClient.quiz.findMany({
        where: {
          Card: {
            userId,
            langCode,
          },
        },
        orderBy: {
          lastReview: "desc",
        },
        take: 1000,
        select: {
          cardId: true,
        },
      })
    ).map((quiz) => quiz.cardId);
    const inspiration = shuffle(
      await prismaClient.card.findMany({
        where: {
          id: {
            in: shuffle(unique(cardIDs)).slice(0, 3),
          },
        },
        select: {
          term: true,
        },
      }),
    ).map((x) => x.term);

    if (inspiration.length < 1) {
      return ["Please study more vocabulary to generate prompts."];
    }

    // New prompt incorporating inspiration sentences and specific instructions
    const prompt = `

You are an expert language and creative writing instructor.
Using a hidden list of inspirational target language sentences (which you can see but the learner cannot),
generate distinct and engaging writing prompts that avoiding being cliche or overly broad.
These prompts should subtly capture the vibes and themes drawn from the hidden sentences without revealing any of their content.
Write all prompts in ${getLangName(langCode)}.

Ensure that the writing prompts engage themes and situations implied by the hidden examples.

Generate the following writing prompts:

1. The first prompt involves responding to an open-ended question in a short, concise manner.
SECRET INSPRIATION: ${inspiration[0]}

2. The second question involves playing a role in a scenario. Test-takers are presented with a real-world scenario and asked to act out a role, demonstrating their ability to use the language in a practical context.
SECRET INSPRIATION: ${inspiration[1]}

3. The last prompt involves presenting opinions on a given topic. This question tests the ability to articulate personal views and opinions.
SECRET INSPRIATION: ${inspiration[3]}

Please craft each of these prompts so they inspire creative thinking and clear, thoughtful responses, drawing on the hidden thematic cues without disclosing them to the learner.

Present the user with the prompt, but don't give the prompts titles or categories. Just provide the prompts directly.

Use natural sounding ${getLangName(langCode)}.
Don't make it sound like it came out of Google translate.
`;
    console.log(prompt);
    const response1 = await openai.beta.chat.completions.parse({
      messages: [{ role: "system", content: prompt }],
      model: "chatgpt-4o-latest",
    });

    return [response1.choices[0].message.content || "No prompts generated."];
  });
