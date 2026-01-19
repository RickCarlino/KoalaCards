import React from "react";
import { Box, Paper, Stack, Text } from "@mantine/core";
import AssistantMessageContent from "./AssistantMessageContent";
import { DeckSummary } from "@/koala/types/deck-summary";
import { AssistantEditProposal, ChatMessage, Suggestion } from "./types";

type MessageTone = "user" | "assistant";

const getMessageTone = (role: ChatMessage["role"]): MessageTone => {
  if (role === "user") {
    return "user";
  }
  return "assistant";
};

const getMessageLabel = (role: ChatMessage["role"]) =>
  role === "user" ? "You" : "Assistant";

const messageToneStyles: Record<
  MessageTone,
  { background: string; labelColor: string }
> = {
  user: { background: "pink.1", labelColor: "pink.8" },
  assistant: { background: "pink.0", labelColor: "pink.7" },
};

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

const messageScrollContainerStyle = {
  overflowY: "auto",
  overflowX: "hidden",
} as const;

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
    <Box
      ref={viewportRef}
      h="100%"
      mih={0}
      style={messageScrollContainerStyle}
    >
      <Stack gap="sm" pr="sm" mih="100%" justify="flex-end">
        {messages.map((message, index) => {
          const tone = getMessageTone(message.role);
          const styles = messageToneStyles[tone];

          return (
            <Paper
              key={index}
              p="sm"
              bg={styles.background}
              radius="md"
              shadow="xs"
            >
              <Text size="xs" fw={600} c={styles.labelColor} mb={4}>
                {getMessageLabel(message.role)}
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
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
