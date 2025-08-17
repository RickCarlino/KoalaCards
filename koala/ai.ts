import { z } from "zod";
import {
  openaiGenerateImage,
  openaiGenerateStructuredOutput,
  openaiGenerateText,
  openaiTranscribeAudio,
} from "./ai-openai";
import {
  anthropicGenerateStructuredOutput,
  anthropicGenerateText,
} from "./ai-anthropic";
import type { CoreMessage } from "./ai-types";
export type { CoreMessage } from "./ai-types";
export type LLMVendor = "openai" | "anthropic";
export type TextModel = "reasoning" | "default";
export type ImageModel = "imageDefault";
export type LanguageModelIdentifier = [LLMVendor, TextModel];
export type ImageModelIdentifier = [LLMVendor, ImageModel];

export async function generateAIText(options: {
  model: LanguageModelIdentifier;
  messages: CoreMessage[];
}) {
  switch (options.model[0]) {
    case "openai":
      return await openaiGenerateText(options);
    case "anthropic":
      return await anthropicGenerateText(options);
    default:
      throw new Error("Not implemented");
  }
}

export async function generateStructuredOutput<
  S extends z.ZodTypeAny,
>(options: {
  model: LanguageModelIdentifier;
  messages: CoreMessage[];
  schema: S;
}): Promise<z.infer<S>> {
  switch (options.model[0]) {
    case "openai":
      return await openaiGenerateStructuredOutput<S>(options);
    case "anthropic":
      return await anthropicGenerateStructuredOutput<S>(options);
    default:
      throw new Error("Not implemented");
  }
}

export async function generateAIImage(
  prompt: string,
  model: ImageModelIdentifier,
) {
  switch (model[0]) {
    case "openai":
      return await openaiGenerateImage({ model, prompt });
    default:
      throw new Error("Not implemented");
  }
}

export async function transcribeAudio(
  audioFile: Buffer | ArrayBuffer,
  options: { model: string; prompt?: string; filename?: string },
) {
  return await openaiTranscribeAudio(audioFile, options);
}
