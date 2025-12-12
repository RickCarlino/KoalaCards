import {
  AssistantParserResult,
  CardEditBlock,
  EDIT_PLACEHOLDER,
} from "@/koala/utils/example-stream-parser";
import {
  AssistantCardContext,
  AssistantEditProposal,
  ChatMessage,
  Suggestion,
} from "./types";

export type AssistantCardUpdates = { term: string; definition: string };

type AssistantExample = { phrase: string; translation: string };

const isPresent = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

export const collapseNewlines = (value: string) =>
  value.replace(/\n{3,}/g, "\n\n");

export function stripEditPlaceholders(content: string, keep: number) {
  let updated = content;
  const placeholderCount = updated.split(EDIT_PLACEHOLDER).length - 1;
  let excess = placeholderCount - keep;

  while (excess > 0) {
    updated = updated.replace(EDIT_PLACEHOLDER, "");
    excess -= 1;
  }

  return collapseNewlines(updated);
}

export function toSuggestion(example: AssistantExample): Suggestion {
  return {
    phrase: example.phrase,
    translation: example.translation,
    gender: "N",
  };
}

export function createProposalId(cardId: number) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `edit-${cardId}-${Date.now()}-${rand}`;
}

function resolveEditTarget(
  draft: CardEditBlock,
  currentCard?: AssistantCardContext,
) {
  const cardId = draft.cardId ?? currentCard?.cardId ?? null;
  if (!cardId) {
    return { cardId: null, targetCard: undefined };
  }

  const targetCard =
    currentCard?.cardId === cardId ? currentCard : undefined;
  return { cardId, targetCard };
}

export function buildEditProposal(
  draft: CardEditBlock,
  currentCard?: AssistantCardContext,
): AssistantEditProposal | null {
  const { cardId, targetCard } = resolveEditTarget(draft, currentCard);
  if (!cardId) {
    return null;
  }

  const term = draft.term?.trim() || targetCard?.term || "";
  const definition =
    draft.definition?.trim() || targetCard?.definition || "";
  if (!term && !definition) {
    return null;
  }

  return {
    id: createProposalId(cardId),
    cardId,
    term,
    definition,
    note: draft.note,
    originalTerm: targetCard?.term,
    originalDefinition: targetCard?.definition,
  };
}

export function updateMessagesWithParserResult(
  messages: ChatMessage[],
  parsed: AssistantParserResult,
  currentCard?: AssistantCardContext,
): ChatMessage[] {
  const hasUpdates =
    Boolean(parsed.textDelta) ||
    parsed.examples.length > 0 ||
    parsed.edits.length > 0;
  if (!hasUpdates) {
    return messages;
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") {
    return messages;
  }

  const content = parsed.textDelta
    ? collapseNewlines(`${last.content}${parsed.textDelta}`)
    : last.content;

  const suggestions = parsed.examples.length
    ? [...(last.suggestions ?? []), ...parsed.examples.map(toSuggestion)]
    : last.suggestions;

  const newEdits = parsed.edits
    .map((draft) => buildEditProposal(draft, currentCard))
    .filter(isPresent);

  const edits = newEdits.length
    ? [...(last.edits ?? []), ...newEdits]
    : last.edits;

  const updated: ChatMessage = { ...last, content, suggestions, edits };
  return [...messages.slice(0, -1), updated];
}

export function removeEditProposalFromMessages(
  messages: ChatMessage[],
  editId: string,
): ChatMessage[] {
  return messages.map((message) => {
    const edits = message.edits;
    if (!edits || edits.length === 0) {
      return message;
    }

    const remaining = edits.filter((proposal) => proposal.id !== editId);
    if (remaining.length === edits.length) {
      return message;
    }

    const content = stripEditPlaceholders(
      message.content,
      remaining.length,
    );
    const nextEdits = remaining.length ? remaining : undefined;

    return { ...message, content, edits: nextEdits };
  });
}
