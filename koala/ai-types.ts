export type TextModel = "good" | "fast" | "cheap";
export type CoreContent = string | TextContentPart[];
export type TextContentPart = { type: "text"; text: string };
export type CoreMessage = {
  role: "system" | "user" | "assistant";
  content: CoreContent;
};
