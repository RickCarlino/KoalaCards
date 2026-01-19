import React from "react";
import { notifications } from "@mantine/notifications";
import { trpc } from "@/koala/trpc-config";
import {
  AssistantParserResult,
  CardEditBlock,
  EDIT_PLACEHOLDER,
  createAssistantStreamParser,
} from "@/koala/utils/example-stream-parser";
import {
  AssistantCardContext,
  AssistantEditProposal,
  ChatMessage,
  Suggestion,
} from "./types";

const collapseNewlines = (value: string) =>
  value.replace(/\n{3,}/g, "\n\n");

const stripEditPlaceholders = (content: string, keep: number) => {
  let updated = content;
  const placeholderCount = updated.split(EDIT_PLACEHOLDER).length - 1;
  let excess = placeholderCount - keep;
  while (excess > 0) {
    updated = updated.replace(EDIT_PLACEHOLDER, "");
    excess -= 1;
  }
  return collapseNewlines(updated);
};

type StreamHandlers = {
  onChunk: (payload: string) => void;
  onDone: () => void;
};

type UseAssistantChatOptions = {
  deckId: number;
  contextLog: string[];
  currentCard?: AssistantCardContext;
  onCardEdited?: (
    cardId: number,
    updates: { term: string; definition: string },
  ) => void;
};

async function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: StreamHandlers,
) {
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const chunk of parts) {
      let event: string | null = null;
      const dataLines: string[] = [];
      chunk.split("\n").forEach((line) => {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
          return;
        }
        if (line.startsWith("data:")) {
          const valueLine = line.slice(5).replace(/^ /, "");
          dataLines.push(valueLine);
        }
      });
      const payload = dataLines.join("\n");
      if (event === "done") {
        handlers.onDone();
        finished = true;
        break;
      }
      handlers.onChunk(payload);
    }
  }

  if (!finished) {
    handlers.onDone();
  }
}

const createProposalId = (cardId: number) =>
  `edit-${cardId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const INITIAL_ASSISTANT_MESSAGE =
  "Hey! Ask me about the cards you just reviewed, or request new practice questions. I’ll also suggest new flashcards or edits when helpful.";

const createInitialMessages = (): ChatMessage[] => [
  {
    role: "assistant",
    content: INITIAL_ASSISTANT_MESSAGE,
  },
];

export function useAssistantChat({
  deckId,
  contextLog,
  currentCard,
  onCardEdited,
}: UseAssistantChatOptions) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(
    createInitialMessages,
  );
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
  const messagesRef = React.useRef<ChatMessage[]>(messages);
  const contextLogRef = React.useRef<string[]>(contextLog);
  const currentCardRef = React.useRef<AssistantCardContext | undefined>(
    currentCard,
  );
  const stopRequestedRef = React.useRef(false);
  const bulkCreate = trpc.bulkCreateCards.useMutation();
  const editCardMutation = trpc.editCard.useMutation();

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  React.useEffect(() => {
    contextLogRef.current = contextLog;
  }, [contextLog]);

  React.useEffect(() => {
    currentCardRef.current = currentCard;
  }, [currentCard]);

  const scrollToBottom = React.useCallback(() => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const toSuggestion = (example: {
    phrase: string;
    translation: string;
  }): Suggestion => ({
    phrase: example.phrase,
    translation: example.translation,
    gender: "N",
  });

  const createEditProposal = React.useCallback(
    (draft: CardEditBlock): AssistantEditProposal | null => {
      const latestCard = currentCardRef.current;
      const resolvedCardId = draft.cardId ?? latestCard?.cardId;
      if (!resolvedCardId) {
        return null;
      }
      const targetCard =
        latestCard && resolvedCardId === latestCard.cardId
          ? latestCard
          : undefined;
      const resolvedTerm = draft.term?.trim() || targetCard?.term || "";
      const resolvedDefinition =
        draft.definition?.trim() || targetCard?.definition || "";
      if (!resolvedTerm && !resolvedDefinition) {
        return null;
      }
      return {
        id: createProposalId(resolvedCardId),
        cardId: resolvedCardId,
        term: resolvedTerm,
        definition: resolvedDefinition,
        note: draft.note,
        originalTerm: targetCard?.term,
        originalDefinition: targetCard?.definition,
      };
    },
    [],
  );

  const applyParsed = React.useCallback(
    (parsed: AssistantParserResult) => {
      if (
        !parsed.textDelta &&
        parsed.examples.length === 0 &&
        parsed.edits.length === 0
      ) {
        return;
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") {
          return prev;
        }
        const nextContent = parsed.textDelta
          ? collapseNewlines(`${last.content}${parsed.textDelta}`)
          : last.content;
        const nextSuggestions = parsed.examples.length
          ? [
              ...(last.suggestions ?? []),
              ...parsed.examples.map(toSuggestion),
            ]
          : last.suggestions;
        const newEdits = parsed.edits
          .map(createEditProposal)
          .filter((proposal): proposal is AssistantEditProposal =>
            Boolean(proposal),
          );
        const nextEdits = newEdits.length
          ? [...(last.edits ?? []), ...newEdits]
          : last.edits;

        const updated: ChatMessage = {
          ...last,
          content: nextContent,
          suggestions: nextSuggestions,
          edits: nextEdits,
        };
        return [...prev.slice(0, -1), updated];
      });
    },
    [createEditProposal],
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
    async (suggestion: Suggestion, targetDeckId: number) => {
      await bulkCreate.mutateAsync({
        deckId: targetDeckId,
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
    [bulkCreate],
  );

  const removeEditProposal = React.useCallback((editId: string) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (!message.edits || message.edits.length === 0) {
          return message;
        }
        const remaining = message.edits.filter(
          (proposal) => proposal.id !== editId,
        );
        if (remaining.length === message.edits.length) {
          return message;
        }
        const trimmedContent = stripEditPlaceholders(
          message.content,
          remaining.length,
        );
        return {
          ...message,
          content: trimmedContent,
          edits: remaining.length ? remaining : undefined,
        };
      }),
    );
  }, []);

  const applyEditProposal = React.useCallback(
    async (
      proposal: AssistantEditProposal,
      updates: { term: string; definition: string },
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
      await readStream(reader, {
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

  const clearMessages = React.useCallback(() => {
    if (isStreaming) {
      return;
    }
    const initialMessages = createInitialMessages();
    messagesRef.current = initialMessages;
    setInput("");
    setMessages(initialMessages);
    setSavingEditId(null);
  }, [isStreaming]);

  return {
    messages,
    input,
    setInput,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    viewportRef,
    addSuggestion,
    isAddingSuggestion: bulkCreate.isLoading,
    onApplyEdit: applyEditProposal,
    onDismissEdit: removeEditProposal,
    savingEditId,
  };
}
