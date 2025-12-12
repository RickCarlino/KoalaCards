import React from "react";
import { notifications } from "@mantine/notifications";
import { trpc } from "@/koala/trpc-config";
import {
  AssistantParserResult,
  createAssistantStreamParser,
} from "@/koala/utils/example-stream-parser";
import { useLatestRef } from "@/koala/hooks/use-latest-ref";
import {
  AssistantCardContext,
  AssistantEditProposal,
  ChatMessage,
  Suggestion,
} from "./types";
import { readSseStream } from "./sse";
import {
  AssistantCardUpdates,
  removeEditProposalFromMessages,
  updateMessagesWithParserResult,
} from "./assistant-chat-helpers";

type UseAssistantChatOptions = {
  deckId: number;
  contextLog: string[];
  currentCard?: AssistantCardContext;
  onCardEdited?: (cardId: number, updates: AssistantCardUpdates) => void;
};

export function useAssistantChat({
  deckId,
  contextLog,
  currentCard,
  onCardEdited,
}: UseAssistantChatOptions) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me about the cards you just reviewed, or request new practice questions. I’ll also suggest new flashcards or edits when helpful.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [savingEditId, setSavingEditId] = React.useState<string | null>(
    null,
  );
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const parserRef = React.useRef<ReturnType<
    typeof createAssistantStreamParser
  > | null>(null);
  const messagesRef = useLatestRef(messages);
  const contextLogRef = useLatestRef(contextLog);
  const currentCardRef = useLatestRef(currentCard);
  const stopRequestedRef = React.useRef(false);
  const bulkCreate = trpc.bulkCreateCards.useMutation();
  const editCardMutation = trpc.editCard.useMutation();

  const scrollToBottom = React.useCallback(() => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const applyParsed = React.useCallback(
    (parsed: AssistantParserResult) => {
      const latestCard = currentCardRef.current;
      setMessages((prev) =>
        updateMessagesWithParserResult(prev, parsed, latestCard),
      );
    },
    [currentCardRef],
  );

  const finalizeParser = React.useCallback(() => {
    const parser = parserRef.current;
    if (!parser) {
      return;
    }
    const parsed = parser.flush();
    parserRef.current = null;
    applyParsed(parsed);
  }, [applyParsed]);

  const resetStreamingState = React.useCallback(() => {
    abortRef.current = null;
    parserRef.current = null;
    stopRequestedRef.current = false;
  }, []);

  const stopStreaming = React.useCallback(() => {
    if (!isStreaming) {
      return;
    }
    stopRequestedRef.current = true;
    abortRef.current?.abort();
    setIsStreaming(false);
  }, [isStreaming]);

  const addSuggestion = React.useCallback(
    async (suggestion: Suggestion) => {
      await bulkCreate.mutateAsync({
        deckId,
        input: [
          {
            term: suggestion.phrase,
            definition: suggestion.translation,
            gender: suggestion.gender,
          },
        ],
      });
      notifications.show({
        title: "Added",
        message: "Card added to deck",
      });
    },
    [bulkCreate, deckId],
  );

  const removeEditProposal = React.useCallback((editId: string) => {
    setMessages((prev) => removeEditProposalFromMessages(prev, editId));
  }, []);

  const applyEditProposal = React.useCallback(
    async (
      proposal: AssistantEditProposal,
      updates: AssistantCardUpdates,
    ) => {
      const term = updates.term.trim();
      const definition = updates.definition.trim();
      setSavingEditId(proposal.id);
      try {
        await editCardMutation.mutateAsync({
          id: proposal.cardId,
          term,
          definition,
        });
        removeEditProposal(proposal.id);
        onCardEdited?.(proposal.cardId, { term, definition });
        notifications.show({
          title: "Card updated",
          message: "Changes saved to the card.",
        });
      } catch {
        notifications.show({
          title: "Assistant error",
          message: "Unable to update the card.",
          color: "red",
        });
      } finally {
        setSavingEditId(null);
      }
    },
    [editCardMutation, onCardEdited, removeEditProposal],
  );

  const sendMessage = React.useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) {
      return;
    }
    stopRequestedRef.current = false;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: "assistant", content: "" },
    ]);
    parserRef.current = createAssistantStreamParser();

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const payload = JSON.stringify({
      deckId,
      messages: [...messagesRef.current, userMsg],
      contextLog: contextLogRef.current,
      currentCard: currentCardRef.current,
    });

    const applyChunk = (chunk: string) => {
      const parser = parserRef.current ?? createAssistantStreamParser();
      parserRef.current = parser;
      const parsed = parser.push(chunk);
      applyParsed(parsed);
    };

    try {
      setIsStreaming(true);
      const res = await fetch("/api/study-assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error("Failed to connect");
      }
      const reader = res.body.getReader();
      await readSseStream(reader, {
        onChunk: (chunk) => {
          applyChunk(chunk);
        },
        onDone: () => {
          finalizeParser();
          setIsStreaming(false);
        },
      });
    } catch {
      const abortedByUser =
        controller.signal.aborted && stopRequestedRef.current;
      finalizeParser();
      setIsStreaming(false);
      if (!abortedByUser) {
        notifications.show({
          title: "Assistant error",
          message: "Connection failed.",
          color: "red",
        });
      }
    } finally {
      resetStreamingState();
    }
  }, [
    applyParsed,
    deckId,
    finalizeParser,
    input,
    isStreaming,
    resetStreamingState,
  ]);

  return {
    messages,
    input,
    setInput,
    isStreaming,
    sendMessage,
    stopStreaming,
    viewportRef,
    addSuggestion,
    isAddingSuggestion: bulkCreate.isLoading,
    onApplyEdit: applyEditProposal,
    onDismissEdit: removeEditProposal,
    savingEditId,
  };
}
