import type { DeckOption } from "@/koala/create/create-utils";
import type { State } from "@/koala/types/create-types";
import {
  Paper,
  Group,
  Title,
  Radio,
  Select,
  TextInput,
} from "@mantine/core";
import React from "react";

type DeckSelection = State["deckSelection"];

type DeckSectionProps = {
  deckOptions: DeckOption[];
  deckSelection: DeckSelection;
  deckId?: number;
  deckName: string;
  onSelectExistingDeck: (val: string | null) => void;
  onSetSelection: (sel: DeckSelection) => void;
  onSetDeckName: (name: string) => void;
};

export function DeckSection(props: DeckSectionProps) {
  const {
    deckOptions,
    deckSelection,
    deckId,
    deckName,
    onSelectExistingDeck,
    onSetSelection,
    onSetDeckName,
  } = props;

  const fieldsBySelection: Record<DeckSelection, React.ReactNode> = {
    existing: (
      <Select
        data={deckOptions}
        value={deckId ? String(deckId) : null}
        onChange={onSelectExistingDeck}
        placeholder="Pick a deck"
        label="Existing deck"
      />
    ),
    new: (
      <TextInput
        label="Deck name"
        placeholder="My Travel Phrases"
        value={deckName}
        onChange={(e) => onSetDeckName(e.currentTarget.value)}
        mb="sm"
      />
    ),
  };

  return (
    <Paper withBorder p="md" radius="md" mb="md">
      <Group justify="space-between" mb="xs">
        <Title order={4}>Deck</Title>
        <Radio.Group
          value={deckSelection}
          onChange={(value) => onSetSelection(value as DeckSelection)}
        >
          <Group gap="sm">
            <Radio value="existing" label="Existing" />
            <Radio value="new" label="New" />
          </Group>
        </Radio.Group>
      </Group>
      {fieldsBySelection[deckSelection]}
    </Paper>
  );
}
