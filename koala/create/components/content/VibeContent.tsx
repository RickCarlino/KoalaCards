import { Button, Group, Text, Textarea } from "@mantine/core";
import React from "react";

type VibeContentProps = {
  textColor: string;
  deckLangName: string;
  rawInput: string;
  setRawInput: (text: string) => void;
  onGenerate: () => void;
};

export function VibeContent(props: VibeContentProps) {
  const { textColor, deckLangName, rawInput, setRawInput, onGenerate } =
    props;

  return (
    <>
      <Text size="sm" c={textColor} mb="xs">
        What cards shall we create? Example:{" "}
        {`"Please make 25 ${deckLangName} example sentences about food."`}
      </Text>
      <Textarea
        minRows={6}
        autosize
        placeholder={`Please make 25 ${deckLangName} example sentences about travel.`}
        value={rawInput}
        onChange={(e) => setRawInput(e.currentTarget.value)}
      />
      <Group justify="flex-end" mt="md">
        <Button onClick={onGenerate}>Generate</Button>
      </Group>
    </>
  );
}
