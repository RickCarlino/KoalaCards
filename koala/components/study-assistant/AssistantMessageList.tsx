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
import { ChatMessage, Suggestion } from "./types";
import { EXAMPLE_PLACEHOLDER } from "@/koala/utils/example-stream-parser";

type AssistantMessageListProps = {
  messages: ChatMessage[];
  viewportRef: React.RefObject<HTMLDivElement>;
  onAddSuggestion: (suggestion: Suggestion) => void | Promise<void>;
  isAdding: boolean;
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
  message: ChatMessage,
  key: string,
): React.ReactNode | null {
  if (!message.content) {
    return null;
  }
  if (message.role === "assistant") {
    return (
      <AssistantMarkdown
        key={key}
        content={message.content}
        style={messageTextStyle}
      />
    );
  }
  return (
    <Text key={key} style={messageTextStyle}>
      {message.content}
    </Text>
  );
}

function renderMessageContent(
  message: ChatMessage,
  messageIndex: number,
  onAddSuggestion: (suggestion: Suggestion) => void,
  isAdding: boolean,
) {
  const nodes: React.ReactNode[] = [];
  const suggestions = message.suggestions ?? [];
  const hasInlineExamples =
    suggestions.length > 0 &&
    message.content.includes(EXAMPLE_PLACEHOLDER);

  if (hasInlineExamples) {
    const parts = message.content.split(EXAMPLE_PLACEHOLDER);
    let suggestionIdx = 0;
    parts.forEach((part, partIdx) => {
      const textNode = renderTextNode(
        { ...message, content: part },
        `msg-${messageIndex}-text-${partIdx}`,
      );
      if (textNode) {
        nodes.push(textNode);
      }
      if (partIdx < parts.length - 1) {
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
      }
    });
    if (suggestionIdx < suggestions.length) {
      for (let idx = suggestionIdx; idx < suggestions.length; idx += 1) {
        const suggestion = suggestions[idx];
        nodes.push(
          <ExampleSuggestionRow
            key={`msg-${messageIndex}-extra-${idx}`}
            suggestion={suggestion}
            onAdd={() => onAddSuggestion(suggestion)}
            isLoading={isAdding}
          />,
        );
      }
    }
    return nodes;
  }

  const fallbackNode = renderTextNode(message, `msg-${messageIndex}-text`);
  if (fallbackNode) {
    nodes.push(fallbackNode);
  }

  suggestions.forEach((suggestion, idx) => {
    nodes.push(
      <ExampleSuggestionRow
        key={`msg-${messageIndex}-fallback-${idx}`}
        suggestion={suggestion}
        onAdd={() => onAddSuggestion(suggestion)}
        isLoading={isAdding}
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
              )}
            </Stack>
          </Box>
        ))}
      </Stack>
    </ScrollArea>
  );
}
