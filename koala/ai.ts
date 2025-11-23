import { z } from "zod";
import {
  openaiGenerateImage,
  openaiGenerateStructuredOutput,
  openaiGenerateText,
} from "./ai-openai";
import {
  anthropicGenerateStructuredOutput,
  anthropicGenerateText,
} from "./ai-anthropic";
import type { CoreMessage } from "./ai-types";
export type { CoreMessage } from "./ai-types";
export type LLMVendor = "openai" | "anthropic";
export type TextModel = "good" | "fast" | "cheap";
export type ImageModel = "imageDefault";
export type LanguageModelIdentifier = [LLMVendor, TextModel];
export type ImageModelIdentifier = [LLMVendor, ImageModel];

export type LanguageGenOptions = {
  model: LanguageModelIdentifier;
  messages: CoreMessage[];
  maxTokens?: number;
};
export type StructuredGenOptions<S extends z.ZodTypeAny> =
  LanguageGenOptions & {
    schema: S;
  };

export type LanguageGenFn = (
  options: LanguageGenOptions,
) => Promise<string>;
export type StructuredGenFn = <S extends z.ZodTypeAny>(
  options: StructuredGenOptions<S>,
) => Promise<z.infer<S>>;
export type ImageGenOptions = {
  model: ImageModelIdentifier;
  prompt: string;
};
export type ImageGenFn = (options: ImageGenOptions) => Promise<string>;

export const generateAIText: LanguageGenFn = async (options) => {
  switch (options.model[0]) {
    case "openai":
      return await openaiGenerateText(options);
    case "anthropic":
      return await anthropicGenerateText(options);
    default:
      throw new Error("Not implemented");
  }
};

export const generateStructuredOutput: StructuredGenFn = async (
  options,
) => {
  switch (options.model[0]) {
    case "openai":
      return await openaiGenerateStructuredOutput(options);
    case "anthropic":
      return await anthropicGenerateStructuredOutput(options);
    default:
      throw new Error("Not implemented");
  }
};

export const generateAIImage: (
  prompt: string,
  model: ImageModelIdentifier,
) => Promise<string> = async (prompt, model) => {
  switch (model[0]) {
    case "openai":
      return await openaiGenerateImage({ model, prompt });
    default:
      throw new Error("Not implemented");
  }
};
