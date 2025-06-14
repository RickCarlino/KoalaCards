// import { openai } from "@/koala/openai";
// import { zodResponseFormat } from "openai/helpers/zod";
// import { z } from "zod";
// import { template } from "radash";
// import { ChatCompletionMessageParam } from "openai/resources";

// const TRANSLATION = z.array(z.string());

// const LemmaSchema = z.object({ roots: TRANSLATION });

// const SYSTEM_PROMPT = `
// You are a reverse dictionary.
// You take a text and extract the "root words" from it.
// Extract a list of the "root words" from the text below and do nothing else.
// Exclude proper nouns, numbers, and any other word not found in a dictionary.
// `;

// const USER_PROMPT = `
// {{WORDS}}
// `;

// function tpl(x: any, y: any) {
//   return template(x, y);
// }

// export async function lemmas(words: string, language = "Korean") {
//   if (words.length < 1) {
//     return [];
//   }

//   const part1: ChatCompletionMessageParam[] = [
//     {
//       role: "system",
//       content: tpl(SYSTEM_PROMPT, { LANGUAGE: language }),
//     },
//     {
//       role: "user",
//       content: tpl(USER_PROMPT, { WORDS: words }),
//     },
//   ];

//   const response1 = await openai.beta.chat.completions.parse({
//     messages: part1,
//     model: "gpt-4.1",
//     response_format: zodResponseFormat(LemmaSchema, "roots"),
//   });

//   const parsedResponse = response1.choices[0]?.message?.parsed;

//   if (!parsedResponse) {
//     throw new Error("Invalid response format from OpenAI.");
//   }

//   return parsedResponse.roots.sort();
// }
