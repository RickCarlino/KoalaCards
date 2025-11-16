import React from "react";
import {
  ActionIcon,
  Box,
  Button,
  Drawer,
  Group,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
  useMantineTheme,
} from "@mantine/core";
import {
  IconMessage,
  IconPlus,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { trpc } from "@/koala/trpc-config";
import { createExampleStreamParser } from "@/koala/utils/example-stream-parser";

type Suggestion = {
  phrase: string;
  translation: string;
  gender: "M" | "F" | "N";
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  suggestions?: Suggestion[];
};

type CurrentCard = {
  term: string;
  definition: string;
  langCode: string;
  lessonType?: "speaking" | "new" | "remedial";
};

const collapseNewlines = (value: string) =>
  value.replace(/\n{3,}/g, "\n\n");

export function ReviewAssistantPane({
  deckId: _deckId,
  current: _current,
  opened: controlledOpened,
  onOpen,
  onClose,
  showFloatingButton = true,
}: {
  deckId: number;
  current: CurrentCard;
  opened?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  showFloatingButton?: boolean;
}) {
  const [uncontrolledOpened, setUncontrolledOpened] =
    React.useState(false);
  const opened = controlledOpened ?? uncontrolledOpened;
  const open = () => (onOpen ? onOpen() : setUncontrolledOpened(true));
  const close = () => (onClose ? onClose() : setUncontrolledOpened(false));
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me about the cards you just reviewed, or request new practice questions. I’ll also suggest new flashcards when helpful.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  // Streaming state
  const abortRef = React.useRef<AbortController | null>(null);
  const parserRef = React.useRef<ReturnType<
    typeof createExampleStreamParser
  > | null>(null);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const bulkCreate = trpc.bulkCreateCards.useMutation();

  const scrollToBottom = React.useCallback(() => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const onSend = async () => {
    const text = input.trim();
    if (!text) {
      return;
    }
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((m) => [
      ...m,
      userMsg,
      { role: "assistant", content: "" },
    ]);
    parserRef.current = createExampleStreamParser();

    const applyParsed = (
      textDelta: string,
      newExamples: { phrase: string; translation: string }[],
    ) => {
      if (!textDelta && newExamples.length === 0) {
        return;
      }
      setMessages((m) => {
        const last = m[m.length - 1];
        if (!last || last.role !== "assistant") {
          return m;
        }
        const nextContent = textDelta
          ? collapseNewlines(last.content + textDelta)
          : last.content;
        const updated: ChatMessage = {
          ...last,
          content: nextContent,
          suggestions: newExamples.length
            ? [
                ...(last.suggestions ?? []),
                ...newExamples.map((ex) => ({
                  phrase: ex.phrase,
                  translation: ex.translation,
                  gender: "N" as const,
                })),
              ]
            : last.suggestions,
        };
        return [...m.slice(0, -1), updated];
      });
    };

    const finalizeParser = () => {
      if (!parserRef.current) {
        return;
      }
      const { textDelta, examples } = parserRef.current.flush();
      parserRef.current = null;
      applyParsed(textDelta, examples);
    };

    // Start streaming
    try {
      setIsStreaming(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const body = JSON.stringify({
        deckId: _deckId,
        current: _current,
        messages: [...messages, userMsg],
      });

      const res = await fetch("/api/study-assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error("Failed to connect");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent: string | null = null;

      // Basic SSE parser: handle event: <name> + data: <payload> frames
      let reading = true;
      while (reading) {
        const { done, value } = await reader.read();
        if (done) {
          reading = false;
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const chunk of parts) {
          const dataLines: string[] = [];
          currentEvent = null;
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
              continue;
            }
            if (line.startsWith("data:")) {
              let v = line.slice(5);
              if (v.startsWith(" ")) {
                v = v.slice(1);
              }
              dataLines.push(v);
              continue;
            }
          }
          const payload = dataLines.join("\n");
          if (!currentEvent) {
            // token frame
            const parser: ReturnType<typeof createExampleStreamParser> =
              parserRef.current ?? createExampleStreamParser();
            parserRef.current = parser;
            const { textDelta, examples } = parser.push(payload);
            applyParsed(textDelta, examples);
            continue;
          }
          if (currentEvent === "done") {
            // End of stream
            finalizeParser();
            setIsStreaming(false);
            reading = false;
            break;
          }
        }
      }
      finalizeParser();
    } catch {
      finalizeParser();
      notifications.show({
        title: "Assistant error",
        message: "Connection failed or aborted.",
        color: "red",
      });
    } finally {
      parserRef.current = null;
      setIsStreaming(false);
    }
  };

  const onStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const onAddSuggestion = async (s: Suggestion) => {
    try {
      await bulkCreate.mutateAsync({
        deckId: _deckId,
        input: [
          { term: s.phrase, definition: s.translation, gender: s.gender },
        ],
      });
      notifications.show({
        title: "Added",
        message: "Card added to deck",
      });
    } catch {
      notifications.show({
        title: "Failed",
        message: "Could not add card",
        color: "red",
      });
    }
  };

  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  return (
    <>
      {/* Optional floating toggle button (desktop only by default) */}
      {showFloatingButton && (
        <Box
          style={{ position: "fixed", right: 16, bottom: 16, zIndex: 300 }}
        >
          <Button
            leftSection={<IconMessage size={18} />}
            onClick={open}
            variant="filled"
            color="indigo"
          >
            Study Assistant
          </Button>
        </Box>
      )}

      <Drawer
        opened={opened}
        onClose={close}
        position={isMobile ? "bottom" : "right"}
        size={isMobile ? "100%" : 420}
        overlayProps={{ opacity: 0.3, blur: 1 }}
        withCloseButton={false}
        styles={{
          content: { display: "flex", flexDirection: "column" },
        }}
      >
        <Group justify="space-between" mb="xs">
          <Title order={4}>Study Assistant</Title>
          <ActionIcon
            variant="subtle"
            onClick={close}
            aria-label="Close assistant"
          >
            <IconX size={18} />
          </ActionIcon>
        </Group>

        <ScrollArea.Autosize
          mah={isMobile ? "55vh" : "calc(100vh - 220px)"}
          viewportRef={viewportRef}
        >
          <Stack gap="sm" pr="sm">
            {messages.map((m, i) => (
              <Box
                key={i}
                p="sm"
                bg={m.role === "user" ? "gray.1" : "blue.0"}
              >
                <Text size="sm" c="dimmed" mb={4}>
                  {m.role === "user" ? "You" : "Assistant"}
                </Text>
                <Text
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.content}
                </Text>
                {m.suggestions && m.suggestions.length > 0 && (
                  <Stack gap={6} mt="sm">
                    {m.suggestions.map((s, idx) => (
                      <Group
                        key={idx}
                        justify="space-between"
                        wrap="nowrap"
                      >
                        <Box>
                          <Text fw={600}>{s.phrase}</Text>
                          <Text size="sm" c="dimmed">
                            {s.translation}
                          </Text>
                        </Box>
                        <Button
                          size="xs"
                          leftSection={<IconPlus size={14} />}
                          loading={bulkCreate.isLoading}
                          onClick={() => onAddSuggestion(s)}
                        >
                          Add card
                        </Button>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>
        </ScrollArea.Autosize>

        <Stack gap="xs" mt="sm">
          <Textarea
            autosize
            minRows={2}
            maxRows={6}
            placeholder="Ask about recent cards or request practice…"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {isStreaming ? "Streaming…" : ""}
            </Text>
            <Group gap="xs">
              {isStreaming ? (
                <Button color="gray" variant="light" onClick={onStop}>
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={onSend}
                  loading={false}
                  leftSection={<IconSend size={16} />}
                  disabled={false}
                >
                  Send
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}

export default ReviewAssistantPane;
