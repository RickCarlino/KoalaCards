import type { CoreMessage } from "@/koala/ai";
import {
  experimental_generateImage as generateImage,
  generateObject,
  generateText,
  experimental_transcribe as transcribe,
} from "ai";
import { z } from "zod";
import { errorReport } from "./error-report";
import {
  getDefaultImageModel,
  getDefaultTextModel,
  getDefaultTranscriptionModel,
  registry,
} from "./provider-registry";

type TextModel = "fast" | "grammar" | "reasoning" | "default";
type ImageModel = "default" | "fast";
type LanguageModelIdentifier =
  | `openai:${TextModel}`
  | `anthropic:${TextModel}`;
type ImageModelIdentifier = `openai:${ImageModel}`;

const GPT_5_OPTIONS = {
  reasoning_effort: "minimal",
  effort: "minimal",
  verbosity: "low",
};

export async function generateAIText(options: {
  model?: LanguageModelIdentifier;
  messages: CoreMessage[];
}) {
  const modelId = options.model?.includes(":")
    ? options.model
    : options.model
      ? `openai:${options.model}`
      : undefined;
  const model = modelId
    ? registry.languageModel(modelId as LanguageModelIdentifier)
    : getDefaultTextModel();
  const providerOptions =
    model.modelId == "gpt-5-nano" ? GPT_5_OPTIONS : {};

  const { text } = await generateText({
    model,
    messages: options.messages,
    providerOptions,
  });

  return text;
}

export function generateStructuredOutput<S extends z.ZodTypeAny>(options: {
  model?: string;
  messages: CoreMessage[];
  schema: S;
}): Promise<z.infer<S>>;
export async function generateStructuredOutput(options: {
  model?: string;
  messages: CoreMessage[];
  schema: z.ZodTypeAny;
}) {
  const other = options.model ? `openai:${options.model}` : undefined;
  const modelId = options.model?.includes(":") ? options.model : other;
  const model = modelId
    ? registry.languageModel(modelId as LanguageModelIdentifier)
    : getDefaultTextModel();
  const providerOptions =
    model.modelId == "gpt-5-nano" ? GPT_5_OPTIONS : {};

  const { object } = await (generateObject as any)({
    model,
    messages: options.messages,
    schema: options.schema,
    providerOptions,
  });

  return object;
}

export async function generateAIImage(
  prompt: string,
  size?: "1024x1024" | "1792x1024" | "1024x1792",
  model?: string,
) {
  const other = model ? `openai:${model}` : undefined;
  const modelId = model?.includes(":") ? model : other;

  const { image } = await generateImage({
    model: modelId
      ? registry.imageModel(modelId as ImageModelIdentifier)
      : getDefaultImageModel(),
    prompt,
    size: size || "1024x1024",
  });

  return image.base64;
}

export async function transcribeAudio(
  audioFile: Buffer | ArrayBuffer,
  options?: {
    model?: string;
    prompt?: string;
  },
) {
  const prompt = options?.prompt || "";
  const { text } = await transcribe({
    model: getDefaultTranscriptionModel(options?.model),
    audio: audioFile,
    providerOptions: { openai: { prompt } },
  });

  return text;
}

export const createDallEPrompt = async (
  term: string,
  definition: string,
  model?: LanguageModelIdentifier,
) => {
  const shortCard = term.split(" ").length < 2;
  const prompt = shortCard ? SINGLE_WORD_PROMPT : SENTENCE_PROMPT;

  const text = await generateAIText({
    model: model || "openai:default",
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
  });

  if (!text) {
    return errorReport("No comic response from AI model.");
  }
  return text;
};

export const createDallEImage = async (
  prompt: string,
  size?: "1024x1024" | "1792x1024" | "1024x1792",
  model?: LanguageModelIdentifier,
) => {
  return await generateAIImage(prompt, size, model);
};

// Prompts
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

export type { CoreMessage } from "ai";
