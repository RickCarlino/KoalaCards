import { generateAIImage, generateAIText } from "./ai";
import { errorReport } from "./error-report";

const SENTENCE_PROMPT = `You are a language learning flash card app.
You are creating a comic to help users remember the flashcard above.
It is a fun, single-frame comic that illustrates the sentence.
Create a DALL-e prompt to create this comic for the card above.
Do not add speech bubbles or text. It will give away the answer!
All characters must be Koalas.`;

const SINGLE_WORD_PROMPT = `You are a language learning flash card app.
Create a DALL-e prompt to generate an image of the foreign language word above.
Make it as realistic and accurate to the words meaning as possible.
The illustration must convey the word's meaning to the student.
humans must be shown as anthropomorphized animals.
Do not add text. It will give away the answer!`;

export const createDallEPrompt = async (
  term: string,
  definition: string,
) => {
  const short = term.split(" ").length < 2;
  const instruction = short ? SINGLE_WORD_PROMPT : SENTENCE_PROMPT;

  const parts: { type: "text"; text: string }[] = [
    { type: "text", text: `Term: ${term}` },
  ];
  if (definition)
    parts.push({ type: "text", text: `Definition: ${definition}` });
  parts.push({ type: "text", text: "Return only the image prompt." });

  const text = await generateAIText({
    model: ["openai", "default"],
    messages: [
      { role: "system", content: instruction },
      { role: "user", content: parts },
    ],
  });

  return text || errorReport("Unable to create an image prompt.");
};

export const createDallEImage = async (prompt: string) => {
  return await generateAIImage(prompt, ["openai", "imageDefault"]);
};
