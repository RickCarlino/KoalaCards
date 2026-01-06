import { z } from "zod";
import {
  openaiGenerateImage,
  openaiGenerateStructuredOutput,
  openaiGenerateText,
} from "./ai-openai";
import type { CoreMessage, TextModel } from "./ai-types";
export type { CoreMessage, TextModel } from "./ai-types";

export type ImageModel = "imageDefault";
export type LanguageModelIdentifier = TextModel;
export type ImageModelIdentifier = ImageModel;

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
  return await openaiGenerateText(options);
};

export const generateStructuredOutput: StructuredGenFn = async (
  options,
) => {
  return await openaiGenerateStructuredOutput(options);
};

export const generateAIImage: (
  prompt: string,
  model: ImageModelIdentifier,
) => Promise<string> = async (prompt, model) => {
  return await openaiGenerateImage({ model, prompt });
};
