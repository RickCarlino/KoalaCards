import React from "react";
import { Stack, Text } from "@mantine/core";
import AssistantMarkdown from "./AssistantMarkdown";
import AssistantEditCard from "./AssistantEditCard";
import AssistantSuggestionRow from "./AssistantSuggestionRow";
import { DeckSummary } from "@/koala/types/deck-summary";
import { AssistantEditProposal, ChatMessage, Suggestion } from "./types";
import {
  EDIT_PLACEHOLDER,
  EXAMPLE_PLACEHOLDER,
} from "@/koala/utils/example-stream-parser";

type AssistantMessageContentProps = {
  message: ChatMessage;
  messageIndex: number;
  onAddSuggestion: (
    suggestion: Suggestion,
    deckId: number,
  ) => void | Promise<void>;
  isAdding: boolean;
  decks: DeckSummary[];
  currentDeckId: number;
  onApplyEdit: (
    proposal: AssistantEditProposal,
    updates: { term: string; definition: string },
  ) => void | Promise<void>;
  onDismissEdit: (proposalId: string) => void;
  savingEditId: string | null;
};

const messageTextStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

type PlaceholderType = "example" | "edit";

const placeholderTokens: Record<PlaceholderType, string> = {
  example: EXAMPLE_PLACEHOLDER,
  edit: EDIT_PLACEHOLDER,
};

type ContentChunk =
  | { kind: "text"; value: string }
  | { kind: "placeholder"; placeholder: PlaceholderType };

const chunkContent = (content: string): ContentChunk[] => {
  const chunks: ContentChunk[] = [];
  let remaining = content;

  const findNextPlaceholder = (
    value: string,
  ): { placeholder: PlaceholderType; index: number } | null => {
    let next: { placeholder: PlaceholderType; index: number } | null =
      null;
    (["example", "edit"] as PlaceholderType[]).forEach((type) => {
      const index = value.indexOf(placeholderTokens[type]);
      if (index === -1) {
        return;
      }
      if (!next || index < next.index) {
        next = { placeholder: type, index };
      }
    });
    return next;
  };

  while (remaining.length > 0) {
    const nextHit = findNextPlaceholder(remaining);
    if (!nextHit) {
      chunks.push({ kind: "text", value: remaining });
      break;
    }

    if (nextHit.index > 0) {
      chunks.push({
        kind: "text",
        value: remaining.slice(0, nextHit.index),
      });
    }

    chunks.push({ kind: "placeholder", placeholder: nextHit.placeholder });
    remaining = remaining.slice(
      nextHit.index + placeholderTokens[nextHit.placeholder].length,
    );
  }

  return chunks;
};

const resolveDefaultDeckId = (
  decks: DeckSummary[],
  currentDeckId: number,
) => {
  const matchesCurrent = decks.some((deck) => deck.id === currentDeckId);
  if (matchesCurrent) {
    return currentDeckId;
  }
  if (decks.length > 0) {
    return decks[0].id;
  }
  return currentDeckId;
};

function renderText(
  message: ChatMessage,
  text: string,
  key: string,
): React.ReactNode | null {
  if (!text) {
    return null;
  }
  if (message.role === "assistant") {
    return (
      <AssistantMarkdown
        key={key}
        content={text}
        style={messageTextStyle}
      />
    );
  }
  return (
    <Text key={key} style={messageTextStyle}>
      {text}
    </Text>
  );
}

export default function AssistantMessageContent({
  message,
  messageIndex,
  onAddSuggestion,
  isAdding,
  decks,
  currentDeckId,
  onApplyEdit,
  onDismissEdit,
  savingEditId,
}: AssistantMessageContentProps) {
  const nodes: React.ReactNode[] = [];
  const suggestions = message.suggestions ?? [];
  const edits = message.edits ?? [];
  let suggestionIdx = 0;
  let editIdx = 0;
  const defaultDeckId = resolveDefaultDeckId(decks, currentDeckId);

  chunkContent(message.content).forEach((chunk, idx) => {
    if (chunk.kind === "text") {
      const textNode = renderText(
        message,
        chunk.value,
        `msg-${messageIndex}-text-${idx}`,
      );
      if (textNode) {
        nodes.push(textNode);
      }
      return;
    }

    if (chunk.placeholder === "example") {
      const suggestion = suggestions[suggestionIdx];
      if (suggestion) {
        nodes.push(
          <AssistantSuggestionRow
            key={`msg-${messageIndex}-example-${suggestionIdx}`}
            suggestion={suggestion}
            onAdd={(deckId) => onAddSuggestion(suggestion, deckId)}
            isLoading={isAdding}
            decks={decks}
            defaultDeckId={defaultDeckId}
          />,
        );
      }
      suggestionIdx += 1;
      return;
    }

    const proposal = edits[editIdx];
    if (proposal) {
      nodes.push(
        <AssistantEditCard
          key={`msg-${messageIndex}-edit-${proposal.id}`}
          proposal={proposal}
          onSave={(updates) => onApplyEdit(proposal, updates)}
          onDismiss={() => onDismissEdit(proposal.id)}
          isSaving={savingEditId === proposal.id}
        />,
      );
    }
    editIdx += 1;
  });

  suggestions.slice(suggestionIdx).forEach((suggestion, idx) => {
    nodes.push(
      <AssistantSuggestionRow
        key={`msg-${messageIndex}-fallback-${idx}`}
        suggestion={suggestion}
        onAdd={(deckId) => onAddSuggestion(suggestion, deckId)}
        isLoading={isAdding}
        decks={decks}
        defaultDeckId={defaultDeckId}
      />,
    );
  });

  edits.slice(editIdx).forEach((proposal) => {
    nodes.push(
      <AssistantEditCard
        key={`msg-${messageIndex}-edit-${proposal.id}`}
        proposal={proposal}
        onSave={(updates) => onApplyEdit(proposal, updates)}
        onDismiss={() => onDismissEdit(proposal.id)}
        isSaving={savingEditId === proposal.id}
      />,
    );
  });

  return <Stack gap={6}>{nodes}</Stack>;
}
