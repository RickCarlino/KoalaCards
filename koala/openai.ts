import OpenAI from "openai";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources";
import { errorReport } from "./error-report";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  errorReport("Missing ENV Var: OPENAI_API_KEY");
}

const configuration = { apiKey };

export const openai = new OpenAI(configuration);

export async function gptCall(opts: ChatCompletionCreateParamsNonStreaming) {
  return await openai.chat.completions.create(opts);
}

const SENTENCE = `You are a language learning flash card app.
You are creating a comic to help users remember the flashcard above.
It is a fun, single-frame comic that illustrates the sentence.
Create a DALL-e prompt to create this comic for the card above.
Do not add speech bubbles or text. It will give away the answer!
All characters must be Koalas.`;

const SINGLE_WORD = `You are a language learning flash card app.
Create a DALL-e prompt to generate an image of the foreign language word above.
Make it as realistic and accurate to the words meaning as possible.
The illustration must convey the word's meaning to the student.
humans must be shown as anthropomorphized animals.
Do not add text. It will give away the answer!`;

export const createDallEPrompt = async (term: string, definition: string) => {
  const shortCard = term.split(" ").length < 2;
  const prompt = shortCard ? SINGLE_WORD : SENTENCE;
  const hm = await gptCall({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [`TERM: ${term}`, `DEFINITION: ${definition}`].join("\n"),
      },
      {
        role: "system",
        content: prompt,
      },
    ],
    temperature: 1.0,
    max_tokens: 128,
  });
  const val = hm.choices[0].message.content;
  if (!val) {
    return errorReport("No comic response from GPT-4.");
  }
  return val;
};

/** Returns a Base64 string. Creates a DALL-E image based on the provided prompt. */
export const createDallEImage = async (prompt: string) => {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
  });
  return response.data[0].url || "";
};
