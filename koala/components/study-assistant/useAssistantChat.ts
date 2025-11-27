import React from "react";
import { notifications } from "@mantine/notifications";
import { trpc } from "@/koala/trpc-config";
import { createExampleStreamParser } from "@/koala/utils/example-stream-parser";
import { ChatMessage, Suggestion } from "./types";

const collapseNewlines = (value: string) =>
  value.replace(/\n{3,}/g, "\n\n");

type StreamHandlers = {
  onChunk: (payload: string) => void;
  onDone: () => void;
};

type UseAssistantChatOptions = {
  deckId: number;
  contextLog: string[];
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

export function useAssistantChat({
  deckId,
  contextLog,
}: UseAssistantChatOptions) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me about the cards you just reviewed, or request new practice questions. I’ll also suggest new flashcards when helpful.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const parserRef = React.useRef<ReturnType<
    typeof createExampleStreamParser
  > | null>(null);
  const messagesRef = React.useRef<ChatMessage[]>(messages);
  const contextLogRef = React.useRef<string[]>(contextLog);
  const stopRequestedRef = React.useRef(false);
  const bulkCreate = trpc.bulkCreateCards.useMutation();

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  React.useEffect(() => {
    contextLogRef.current = contextLog;
  }, [contextLog]);

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
    (
      textDelta: string,
      newExamples: { phrase: string; translation: string }[],
    ) => {
      if (!textDelta && newExamples.length === 0) {
        return;
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") {
          return prev;
        }
        const nextContent = textDelta
          ? collapseNewlines(`${last.content}${textDelta}`)
          : last.content;
        const updated: ChatMessage = {
          ...last,
          content: nextContent,
          suggestions: newExamples.length
            ? [
                ...(last.suggestions ?? []),
                ...newExamples.map<Suggestion>((example) => ({
                  phrase: example.phrase,
                  translation: example.translation,
                  gender: "N",
                })),
              ]
            : last.suggestions,
        };
        return [...prev.slice(0, -1), updated];
      });
    },
    [],
  );

  const finalizeParser = React.useCallback(() => {
    const parser = parserRef.current;
    if (!parser) {
      return;
    }
    const { textDelta, examples } = parser.flush();
    parserRef.current = null;
    applyParsed(textDelta, examples);
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
    parserRef.current = createExampleStreamParser();

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const payload = JSON.stringify({
      deckId,
      messages: [...messagesRef.current, userMsg],
      contextLog: contextLogRef.current,
    });

    const applyChunk = (chunk: string) => {
      const parser = parserRef.current ?? createExampleStreamParser();
      parserRef.current = parser;
      const { textDelta, examples } = parser.push(chunk);
      applyParsed(textDelta, examples);
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
  };
}
