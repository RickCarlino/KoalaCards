import React from "react";
import { Box, ScrollArea, Stack, Text } from "@mantine/core";
import AssistantMessageContent from "./AssistantMessageContent";
import { DeckSummary } from "@/koala/types/deck-summary";
import { AssistantEditProposal, ChatMessage, Suggestion } from "./types";

type AssistantMessageListProps = {
  messages: ChatMessage[];
  viewportRef: React.RefObject<HTMLDivElement>;
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

export default function AssistantMessageList({
  messages,
  viewportRef,
  onAddSuggestion,
  isAdding,
  decks,
  currentDeckId,
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
            <AssistantMessageContent
              message={message}
              messageIndex={index}
              onAddSuggestion={onAddSuggestion}
              isAdding={isAdding}
              decks={decks}
              currentDeckId={currentDeckId}
              onApplyEdit={onApplyEdit}
              onDismissEdit={onDismissEdit}
              savingEditId={savingEditId}
            />
          </Box>
        ))}
      </Stack>
    </ScrollArea>
  );
}
