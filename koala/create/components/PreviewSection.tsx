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
  const count = processedCards.length;

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Title order={4}>Preview</Title>
        <SaveButton canSave={canSave} count={count} onSave={onSave} />
      </Group>

      <PreviewBody
        cards={processedCards}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    </Paper>
  );
}

function SaveButton(props: {
  canSave: boolean;
  count: number;
  onSave: () => void;
}) {
  const { canSave, count, onSave } = props;
  const label = count ? `Save (${count})` : "Save";
  return (
    <Button onClick={onSave} disabled={!canSave}>
      {label}
    </Button>
  );
}

function PreviewBody(props: {
  cards: State["processedCards"];
  onEdit: (
    index: number,
    field: "term" | "definition",
    value: string,
  ) => void;
  onRemove: (index: number) => void;
}) {
  const { cards, onEdit, onRemove } = props;
  if (!cards.length) {
    return (
      <Text c="dimmed">No cards yet. Generate or parse to preview.</Text>
    );
  }
  return <CardList cards={cards} onEdit={onEdit} onRemove={onRemove} />;
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
