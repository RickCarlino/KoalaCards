export type AssistantRole = "user" | "assistant";

export type Suggestion = {
  phrase: string;
  translation: string;
  gender: "M" | "F" | "N";
};

export type ChatMessage = {
  role: AssistantRole;
  content: string;
  suggestions?: Suggestion[];
};
