import { Button, Group, Text, Textarea } from "@mantine/core";
import React from "react";

type WordlistContentProps = {
  textColor: string;
  rawInput: string;
  setRawInput: (text: string) => void;
  onEnrich: () => void;
};

export function WordlistContent(props: WordlistContentProps) {
  const { textColor, rawInput, setRawInput, onEnrich } = props;

  return (
    <>
      <Text size="sm" c={textColor} mb="xs">
        Paste one word per line. We’ll fetch definitions.
      </Text>
      <Textarea
        minRows={6}
        autosize
        placeholder={`hola\nadiós\npor favor`}
        value={rawInput}
        onChange={(e) => setRawInput(e.currentTarget.value)}
      />
      <Group justify="flex-end" mt="md">
        <Button onClick={onEnrich}>Enrich</Button>
      </Group>
    </>
  );
}
