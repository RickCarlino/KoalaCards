import React from "react";
import {
  ActionIcon,
  Box,
  Button,
  Drawer,
  Group,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { IconMessage, IconX } from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import AssistantMessageList from "./study-assistant/AssistantMessageList";
import AssistantComposer from "./study-assistant/AssistantComposer";
import { useAssistantChat } from "./study-assistant/useAssistantChat";
import { DeckSummary } from "@/koala/types/deck-summary";
import {
  AssistantCardContext,
  AssistantEditProposal,
  ChatMessage,
  Suggestion,
} from "./study-assistant/types";

type ReviewAssistantPaneProps = {
  deckId: number;
  decks: DeckSummary[];
  opened: boolean;
  onOpen: () => void;
  onClose: () => void;
  contextLog: string[];
  currentCard?: AssistantCardContext;
  onCardEdited?: (
    cardId: number,
    updates: { term: string; definition: string },
  ) => void;
};

type AssistantPanelProps = {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onClear: () => void;
  canClear: boolean;
  isStreaming: boolean;
  viewportRef: React.RefObject<HTMLDivElement>;
  onAddSuggestion: (
    suggestion: Suggestion,
    deckId: number,
  ) => void | Promise<void>;
  isAdding: boolean;
  decks: DeckSummary[];
  currentDeckId: number;
  onClose: () => void;
  onApplyEdit: (
    proposal: AssistantEditProposal,
    updates: { term: string; definition: string },
  ) => void | Promise<void>;
  onDismissEdit: (proposalId: string) => void;
  savingEditId: string | null;
};

function AssistantHeader({ onClose }: { onClose: () => void }) {
  return (
    <Group justify="space-between" mb="xs">
      <Group gap="xs">
        <IconMessage size={18} />
        <Title order={4}>Study Assistant</Title>
      </Group>
      <ActionIcon
        variant="subtle"
        onClick={onClose}
        aria-label="Close assistant"
      >
        <IconX size={18} />
      </ActionIcon>
    </Group>
  );
}

function AssistantPanel({
  messages,
  input,
  onInputChange,
  onSend,
  onStop,
  onClear,
  canClear,
  isStreaming,
  viewportRef,
  onAddSuggestion,
  isAdding,
  decks,
  currentDeckId,
  onClose,
  onApplyEdit,
  onDismissEdit,
  savingEditId,
}: AssistantPanelProps) {
  return (
    <Stack gap="sm" h="100%" style={{ minHeight: 0 }}>
      <AssistantHeader onClose={onClose} />
      <Box style={{ flex: 1, minHeight: 0 }}>
        <AssistantMessageList
          messages={messages}
          viewportRef={viewportRef}
          onAddSuggestion={onAddSuggestion}
          isAdding={isAdding}
          decks={decks}
          currentDeckId={currentDeckId}
          onApplyEdit={onApplyEdit}
          onDismissEdit={onDismissEdit}
          savingEditId={savingEditId}
        />
      </Box>
      <AssistantComposer
        value={input}
        onChange={onInputChange}
        onSend={onSend}
        onStop={onStop}
        onClear={onClear}
        canClear={canClear}
        isStreaming={isStreaming}
      />
    </Stack>
  );
}

function DesktopAssistantShell({
  opened,
  onOpen,
  children,
}: {
  opened: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        borderLeft: "1px solid var(--mantine-color-gray-3)",
        backgroundColor: "white",
        padding: opened ? 0 : "16px",
      }}
    >
      {opened ? (
        <Box
          style={{
            height: "100%",
            display: "flex",
            padding: "16px",
            minHeight: 0,
          }}
        >
          <Box style={{ flex: 1, minHeight: 0, width: "100%" }}>
            {children}
          </Box>
        </Box>
      ) : (
        <Stack
          justify="center"
          gap="sm"
          style={{ height: "100%", minHeight: 0 }}
        >
          <Group gap="xs">
            <IconMessage size={18} />
            <Title order={5}>Study Assistant</Title>
          </Group>
          <Text c="dimmed">
            Keep the assistant open alongside your review.
          </Text>
          <Button
            onClick={onOpen}
            leftSection={<IconMessage size={16} />}
            variant="light"
          >
            Open Assistant
          </Button>
        </Stack>
      )}
    </Box>
  );
}

function MobileAssistantShell({
  opened,
  onClose,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="100%"
      overlayProps={{ opacity: 0.35, blur: 1 }}
      withCloseButton={false}
      styles={{
        content: {
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: 0,
        },
      }}
    >
      <Box style={{ flex: 1, padding: "16px", minHeight: 0 }}>
        {children}
      </Box>
    </Drawer>
  );
}

export function ReviewAssistantPane({
  deckId,
  decks,
  opened,
  onOpen,
  onClose,
  contextLog,
  currentCard,
  onCardEdited,
}: ReviewAssistantPaneProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);
  const {
    messages,
    input,
    setInput,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    viewportRef,
    addSuggestion,
    isAddingSuggestion,
    onApplyEdit,
    onDismissEdit,
    savingEditId,
  } = useAssistantChat({
    deckId,
    contextLog,
    currentCard,
    onCardEdited,
  });

  const handleClose = React.useCallback(() => {
    stopStreaming();
    onClose();
  }, [onClose, stopStreaming]);

  const canClear = messages.length > 1 || input.trim() !== "";

  const panel = (
    <AssistantPanel
      messages={messages}
      input={input}
      onInputChange={setInput}
      onSend={sendMessage}
      onStop={stopStreaming}
      onClear={clearMessages}
      canClear={canClear}
      isStreaming={isStreaming}
      viewportRef={viewportRef}
      onAddSuggestion={addSuggestion}
      isAdding={isAddingSuggestion}
      decks={decks}
      currentDeckId={deckId}
      onClose={handleClose}
      onApplyEdit={onApplyEdit}
      onDismissEdit={onDismissEdit}
      savingEditId={savingEditId}
    />
  );

  if (isMobile) {
    return (
      <MobileAssistantShell opened={opened} onClose={handleClose}>
        {panel}
      </MobileAssistantShell>
    );
  }

  return (
    <DesktopAssistantShell opened={opened} onOpen={onOpen}>
      {panel}
    </DesktopAssistantShell>
  );
}

export default ReviewAssistantPane;
