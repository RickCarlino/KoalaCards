import type { State } from "@/koala/types/create-types";
import {
  Button,
  Group,
  Paper,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import React from "react";

type PreviewSectionProps = {
  processedCards: State["processedCards"];
  onEdit: (
    index: number,
    field: "term" | "definition",
    value: string,
  ) => void;
  onRemove: (index: number) => void;
  canSave: boolean;
  onSave: () => void;
};

export function PreviewSection(props: PreviewSectionProps) {
  const { processedCards, onEdit, onRemove, canSave, onSave } = props;

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Title order={4}>Preview</Title>
        <Button onClick={onSave} disabled={!canSave}>
          {processedCards.length
            ? `Save (${processedCards.length})`
            : "Save"}
        </Button>
      </Group>

      {processedCards.length ? (
        <CardList
          cards={processedCards}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ) : (
        <Text c="dimmed">No cards yet. Generate or parse to preview.</Text>
      )}
    </Paper>
  );
}

function CardList(props: {
  cards: State["processedCards"];
  onEdit: (
    index: number,
    field: "term" | "definition",
    value: string,
  ) => void;
  onRemove: (index: number) => void;
}) {
  const { cards, onEdit, onRemove } = props;
  return cards.map((card, index) => (
    <Group key={`${card.term}-${index}`} grow align="flex-end" mb="sm">
      <TextInput
        label="Term"
        value={card.term}
        onChange={(e) => onEdit(index, "term", e.currentTarget.value)}
      />
      <TextInput
        label="Definition"
        value={card.definition}
        onChange={(e) =>
          onEdit(index, "definition", e.currentTarget.value)
        }
      />
      <Button color="red" variant="light" onClick={() => onRemove(index)}>
        Remove
      </Button>
    </Group>
  ));
}
