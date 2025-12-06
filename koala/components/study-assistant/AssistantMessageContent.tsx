import React from "react";
import { ActionIcon, Group, Loader, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import AssistantMarkdown from "./AssistantMarkdown";
import AssistantEditCard from "./AssistantEditCard";
import { AssistantEditProposal, ChatMessage, Suggestion } from "./types";
import {
  EDIT_PLACEHOLDER,
  EXAMPLE_PLACEHOLDER,
} from "@/koala/utils/example-stream-parser";

type AssistantMessageContentProps = {
  message: ChatMessage;
  messageIndex: number;
  onAddSuggestion: (suggestion: Suggestion) => void | Promise<void>;
  isAdding: boolean;
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

function ExampleSuggestionRow({
  suggestion,
  onAdd,
  isLoading,
}: {
  suggestion: Suggestion;
  onAdd: () => void;
  isLoading: boolean;
}) {
  return (
    <Group align="flex-start" gap="xs" wrap="nowrap">
      <ActionIcon
        variant="light"
        color="indigo"
        radius="xl"
        size="md"
        onClick={onAdd}
        disabled={isLoading}
        aria-label={`Add card for ${suggestion.phrase}`}
      >
        {isLoading ? <Loader size="xs" /> : <IconPlus size={14} />}
      </ActionIcon>
      <Stack gap={2}>
        <Text fw={600}>{suggestion.phrase}</Text>
        <Text size="sm" c="dimmed">
          {suggestion.translation}
        </Text>
      </Stack>
    </Group>
  );
}

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
  onApplyEdit,
  onDismissEdit,
  savingEditId,
}: AssistantMessageContentProps) {
  const nodes: React.ReactNode[] = [];
  const suggestions = message.suggestions ?? [];
  const edits = message.edits ?? [];
  let suggestionIdx = 0;
  let editIdx = 0;

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
          <ExampleSuggestionRow
            key={`msg-${messageIndex}-example-${suggestionIdx}`}
            suggestion={suggestion}
            onAdd={() => onAddSuggestion(suggestion)}
            isLoading={isAdding}
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
      <ExampleSuggestionRow
        key={`msg-${messageIndex}-fallback-${idx}`}
        suggestion={suggestion}
        onAdd={() => onAddSuggestion(suggestion)}
        isLoading={isAdding}
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
