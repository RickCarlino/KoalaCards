// Shared AI type definitions to avoid importing vendor SDK types

export type ImageModel = "imageDefault";
export type TextModel = "reasoning" | "default";
export type ModelKind = TextModel | ImageModel;
export type CoreContent = string | TextContentPart[];
export type TextContentPart = { type: "text"; text: string };
export type CoreMessage = {
  role: "system" | "user" | "assistant";
  content: CoreContent;
};
