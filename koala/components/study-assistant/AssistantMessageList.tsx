import React from "react";
import {
  ActionIcon,
  Box,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import AssistantMarkdown from "./AssistantMarkdown";
import AssistantEditCard from "./AssistantEditCard";
import {
  AssistantEditProposal,
  AssistantRole,
  ChatMessage,
  Suggestion,
} from "./types";
import {
  EDIT_PLACEHOLDER,
  EXAMPLE_PLACEHOLDER,
} from "@/koala/utils/example-stream-parser";

type AssistantMessageListProps = {
  messages: ChatMessage[];
  viewportRef: React.RefObject<HTMLDivElement>;
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

function renderTextNode(
  role: AssistantRole,
  content: string,
  key: string,
): React.ReactNode | null {
  if (!content) {
    return null;
  }
  if (role === "assistant") {
    return (
      <AssistantMarkdown
        key={key}
        content={content}
        style={messageTextStyle}
      />
    );
  }
  return (
    <Text key={key} style={messageTextStyle}>
      {content}
    </Text>
  );
}

type PlaceholderType = "example" | "edit";

const placeholderTokens: Record<PlaceholderType, string> = {
  example: EXAMPLE_PLACEHOLDER,
  edit: EDIT_PLACEHOLDER,
};

type PlaceholderHit = {
  type: PlaceholderType;
  index: number;
  token: string;
};

const findNextPlaceholder = (content: string): PlaceholderHit | null => {
  let best: PlaceholderHit | null = null;
  (["example", "edit"] as PlaceholderType[]).forEach((type) => {
    const token = placeholderTokens[type];
    const idx = content.indexOf(token);
    const isCloser = best === null || (idx !== -1 && idx < best.index);
    if (idx !== -1 && isCloser) {
      best = { type, index: idx, token };
    }
  });
  return best;
};

function renderMessageContent(
  message: ChatMessage,
  messageIndex: number,
  onAddSuggestion: (suggestion: Suggestion) => void,
  isAdding: boolean,
  onApplyEdit: (
    proposal: AssistantEditProposal,
    updates: { term: string; definition: string },
  ) => void | Promise<void>,
  onDismissEdit: (proposalId: string) => void,
  savingEditId: string | null,
) {
  const nodes: React.ReactNode[] = [];
  const suggestions = message.suggestions ?? [];
  const edits = message.edits ?? [];
  let suggestionIdx = 0;
  let editIdx = 0;
  let remaining = message.content;

  while (remaining.length > 0) {
    const nextPlaceholder = findNextPlaceholder(remaining);
    if (!nextPlaceholder) {
      const textNode = renderTextNode(
        message.role,
        remaining,
        `msg-${messageIndex}-text-${suggestionIdx}-${editIdx}`,
      );
      if (textNode) {
        nodes.push(textNode);
      }
      break;
    }

    if (nextPlaceholder.index > 0) {
      const textChunk = remaining.slice(0, nextPlaceholder.index);
      const textNode = renderTextNode(
        message.role,
        textChunk,
        `msg-${messageIndex}-text-${suggestionIdx}-${editIdx}-${nextPlaceholder.index}`,
      );
      if (textNode) {
        nodes.push(textNode);
      }
    }

    remaining = remaining.slice(
      nextPlaceholder.index + nextPlaceholder.token.length,
    );

    if (nextPlaceholder.type === "example") {
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
      continue;
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
  }

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

  return nodes;
}

export default function AssistantMessageList({
  messages,
  viewportRef,
  onAddSuggestion,
  isAdding,
  onApplyEdit,
  onDismissEdit,
  savingEditId,
}: AssistantMessageListProps) {
  return (
    <ScrollArea
      viewportRef={viewportRef}
      style={{ height: "100%", minHeight: 0 }}
    >
      <Stack gap="sm" pr="sm">
        {messages.map((message, index) => (
          <Box
            key={index}
            p="sm"
            bg={message.role === "user" ? "gray.1" : "blue.0"}
          >
            <Text size="sm" c="dimmed" mb={4}>
              {message.role === "user" ? "You" : "Assistant"}
            </Text>
            <Stack gap={6}>
              {renderMessageContent(
                message,
                index,
                onAddSuggestion,
                isAdding,
                onApplyEdit,
                onDismissEdit,
                savingEditId,
              )}
            </Stack>
          </Box>
        ))}
      </Stack>
    </ScrollArea>
  );
}
