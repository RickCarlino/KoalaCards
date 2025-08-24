import React from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import {
  IconMessage,
  IconPlus,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { trpc } from "@/koala/trpc-config";

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

export function ReviewAssistantPane({
  deckId,
  current,
}: {
  deckId: number;
  current: CurrentCard;
}) {
  const [opened, setOpened] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me about the cards you just reviewed, or request new practice questions. I’ll also suggest new flashcards when helpful.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  const reviewAssistant = trpc.reviewAssistant.useMutation();
  const bulkCreateCards = trpc.bulkCreateCards.useMutation();
  const [added, setAdded] = React.useState<Record<string, boolean>>({});

  const keyFor = (s: Suggestion) => `${s.phrase}|||${s.translation}`;

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
    if (!text || reviewAssistant.isLoading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    try {
      // Include a short chat history for follow-ups (last 6 incl. pending message)
      const historyPayload = [
        ...messages,
        { role: "user" as const, content: text },
      ]
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await reviewAssistant.mutateAsync({
        deckId,
        userMessage: text,
        history: historyPayload,
        current,
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: result.reply,
          suggestions: result.suggestions,
        },
      ]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry — I couldn’t reply just now. Please try again in a moment. " +
            JSON.stringify(e),
        },
      ]);
    }
  };

  const addSuggestion = async (s: Suggestion) => {
    try {
      await bulkCreateCards.mutateAsync({
        deckId,
        input: [
          {
            term: s.phrase,
            definition: s.translation,
            gender: s.gender,
          },
        ],
      });
      setAdded((prev) => ({ ...prev, [keyFor(s)]: true }));
    } catch (e) {
      // No-op; page toasts might exist elsewhere
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <Box
        style={{ position: "fixed", right: 16, bottom: 16, zIndex: 400 }}
      >
        <Button
          leftSection={<IconMessage size={18} />}
          onClick={() => setOpened(true)}
          variant="filled"
          color="indigo"
        >
          Study Assistant
        </Button>
      </Box>

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position="right"
        size={420}
        overlayProps={{ opacity: 0.3, blur: 1 }}
        withCloseButton={false}
        styles={{
          content: { display: "flex", flexDirection: "column" },
        }}
      >
        <Group justify="space-between" mb="xs">
          <Title order={4}>Study Assistant</Title>
          <ActionIcon variant="subtle" onClick={() => setOpened(false)}>
            <IconX size={18} />
          </ActionIcon>
        </Group>

        <ScrollArea.Autosize
          mah="calc(100vh - 220px)"
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
                <Text>{m.content}</Text>
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
                        <Group gap="xs">
                          {added[keyFor(s)] && (
                            <Badge color="teal" variant="light" size="sm">
                              Added
                            </Badge>
                          )}
                          <Button
                            size="xs"
                            leftSection={<IconPlus size={14} />}
                            loading={bulkCreateCards.isLoading}
                            disabled={!!added[keyFor(s)]}
                            onClick={() => addSuggestion(s)}
                          >
                            Add card
                          </Button>
                        </Group>
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
          <Group justify="flex-end">
            <Button
              onClick={onSend}
              loading={reviewAssistant.isLoading}
              leftSection={<IconSend size={16} />}
            >
              Send
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}

export default ReviewAssistantPane;
