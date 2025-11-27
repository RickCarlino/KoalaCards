import React from "react";
import { Button, Group, Stack, Text, Textarea } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";

type AssistantComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
};

export default function AssistantComposer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
}: AssistantComposerProps) {
  const handleSubmit = () => {
    onSend();
  };

  return (
    <Stack gap="xs" mt="sm">
      <Textarea
        autosize
        minRows={2}
        maxRows={6}
        placeholder="Ask about recent cards or request practice…"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
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
              onClick={handleSubmit}
              leftSection={<IconSend size={16} />}
              disabled={value.trim() === ""}
            >
              Send
            </Button>
          )}
        </Group>
      </Group>
    </Stack>
  );
}
