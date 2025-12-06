export type AssistantRole = "user" | "assistant";

export type Suggestion = {
  phrase: string;
  translation: string;
  gender: "M" | "F" | "N";
};

export type AssistantEditProposal = {
  id: string;
  cardId: number;
  term: string;
  definition: string;
  note?: string;
  originalTerm?: string;
  originalDefinition?: string;
};

export type AssistantCardContext = {
  cardId: number;
  term: string;
  definition: string;
  uuid?: string;
};

export type ChatMessage = {
  role: AssistantRole;
  content: string;
  suggestions?: Suggestion[];
  edits?: AssistantEditProposal[];
};
