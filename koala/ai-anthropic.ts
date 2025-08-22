import type { LanguageGenFn, StructuredGenFn } from "./ai";

export const anthropicGenerateText: LanguageGenFn = async (_options) => {
  throw new Error("Not implemented");
};

export const anthropicGenerateStructuredOutput: StructuredGenFn = async (
  _options,
) => {
  throw new Error("Not implemented");
};
