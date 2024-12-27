import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { openai } from "../openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "../prisma-client";
import { draw } from "radash";
import { RemixTypePrompts, RemixTypes } from "../remix-types";

const zodRemix = z.object({
  result: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    }),
  ),
});

async function askGPT(type: RemixTypes, term: string, _definition: string) {
  const model = "gpt-4o-2024-08-06";
  const temperature = draw([0.5, 0.6, 0.7, 0.8]) || 1;
  const frequency_penalty = draw([0.4, 0.5, 0.6, 0.7]) || 1;
  const presence_penalty = draw([0.4, 0.5, 0.6, 0.7, 0.8]) || 1;
  console.log(
    JSON.stringify([temperature, frequency_penalty, presence_penalty]),
  );

  // RED:
  // [0.75 , 1.25, 0.25],
  // [1    , 1   , 0.5 ],
  // [1    , 1.5 , 0.25],
  // [0.5  , 1.5 , 1.5 ],

  // YELLOW:
  // [0.5 , 0.25, 0.25],
  // [0.75, 0.5 , 0.5 ],
  // [0.5,  0.3,  1],
  // [0.5,  0.5 , 1]
  // [0.6,0.5,1]
  // [0.7 , 0.6 , 1.1 ],
  // [0.8,  0.5,   0.9],

  // GREEN:
  // [0.75, 0.25,  0.25],
  // [0.5 , 0.4 ,  0.9 ],
  // [0.8,  0.4,   0.9 ],
  // [0.5 , 0.5 ,  0.25],
  // [0.5 , 0.5 ,  0.75],
  // [0.75, 0.5 ,  1   ],
  // [0.8 , 0.6 ,  1.1 ],
  // [0.7,  0.6,   1],
  // [0.7,  0.7,   0.8]
  console.log({ type, RemixTypePrompts, val: RemixTypePrompts[type] });
  const resp = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "user",
        content: `${term}`,
      },
      {
        role: "user",
        content: RemixTypePrompts[type],
      },
      {
        role: "assistant",
        content: [
          "The user is a native English speaker learning a foreign language.",
          "Provide several short, grammatically correct 'remix' sentences for language learning.",
          // "Use the student's guidance to create above to guide the content of the new sentences.",
          "The 'definition' attribute is an English translation of the target sentence.",
        ].join("\n"),
      },
    ],
    model,
    max_tokens: 500,
    temperature,
    frequency_penalty, // Encourages variety
    presence_penalty, // Reduces overuse of key words
    response_format: zodResponseFormat(zodRemix, "remix_resp"),
  });
  const grade_response = resp.choices[0];
  const result = grade_response.message.parsed?.result || [];

  return result.sort((a, b) => a.term.length - b.term.length).slice(0, 7);
}
/** The `faucet` route is a mutation that returns a "Hello, world" string
 * and takes an empty object as its only argument. */
export const remix = procedure
  .input(
    z.object({
      cardID: z.number(),
      type: z.number(),
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
    // I will fill this part out, don't worry about it for now.
    // Show it to you so you understand the schema.
    const x = await getUserSettings(ctx.user?.id);
    console.log(x.userId);
    const card = await prismaClient.card.findFirst({
      where: {
        userId: x.userId,
        id: input.cardID,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    if (!card) {
      throw new Error("Card not found");
    }
    return await askGPT(input.type as RemixTypes, card.term, card.definition);
  });
