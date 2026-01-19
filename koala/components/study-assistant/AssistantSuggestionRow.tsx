import React from "react";
import {
  ActionIcon,
  Group,
  Loader,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { DeckSummary } from "@/koala/types/deck-summary";
import { Suggestion } from "./types";

type AssistantSuggestionRowProps = {
  suggestion: Suggestion;
  onAdd: (deckId: number) => void;
  isLoading: boolean;
  decks: DeckSummary[];
  defaultDeckId: number;
};

const toDeckOptions = (decks: DeckSummary[]) =>
  decks.map((deck) => ({
    value: String(deck.id),
    label: deck.name,
  }));

const parseDeckId = (value: string | null, fallback: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
};

export default function AssistantSuggestionRow({
  suggestion,
  onAdd,
  isLoading,
  decks,
  defaultDeckId,
}: AssistantSuggestionRowProps) {
  const [selectedDeckId, setSelectedDeckId] =
    React.useState(defaultDeckId);
  const deckOptions = React.useMemo(() => toDeckOptions(decks), [decks]);
  const isSelectionLocked = isLoading || deckOptions.length <= 1;

  const handleDeckChange = React.useCallback(
    (value: string | null) => {
      setSelectedDeckId(parseDeckId(value, defaultDeckId));
    },
    [defaultDeckId],
  );

  return (
    <Group align="flex-start" gap="xs" wrap="nowrap">
      <ActionIcon
        variant="light"
        color="indigo"
        radius="xl"
        size="md"
        onClick={() => onAdd(selectedDeckId)}
        disabled={isLoading}
        aria-label={`Add card for ${suggestion.phrase}`}
      >
        {isLoading ? <Loader size="xs" /> : <IconPlus size={14} />}
      </ActionIcon>
      <Stack gap={4} style={{ flex: 1 }}>
        <Text fw={600}>{suggestion.phrase}</Text>
        <Text size="sm" c="dimmed">
          {suggestion.translation}
        </Text>
        <Select
          data={deckOptions}
          value={String(selectedDeckId)}
          onChange={handleDeckChange}
          size="xs"
          placeholder="Deck"
          allowDeselect={false}
          disabled={isSelectionLocked}
          aria-label="Choose a deck"
        />
      </Stack>
    </Group>
  );
}
