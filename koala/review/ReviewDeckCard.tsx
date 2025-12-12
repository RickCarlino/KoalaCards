import { trpc } from "@/koala/trpc-config";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconCheck,
  IconMicrophone,
  IconPencil,
  IconStars,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import type { DeckWithReviewInfo } from "@/koala/decks/decks-with-review-info";

type ReviewDeckCardProps = {
  deck: DeckWithReviewInfo;
  isSelected: boolean;
  onToggleSelected: (deckId: number) => void;
  onChanged: () => void;
};

function normalizeTitle(value: string) {
  return value.trim();
}

function hasMeaningfulTitleChange(params: {
  original: string;
  draft: string;
}) {
  return (
    normalizeTitle(params.draft) !== "" &&
    normalizeTitle(params.draft) !== params.original
  );
}

export function ReviewDeckCard({
  deck,
  isSelected,
  onToggleSelected,
  onChanged,
}: ReviewDeckCardProps) {
  const take = 5;
  const updateDeck = trpc.updateDeck.useMutation();
  const deleteDeck = trpc.deleteDeck.useMutation();

  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(deck.name);

  const canSave = useMemo(
    () =>
      hasMeaningfulTitleChange({ original: deck.name, draft: draftTitle }),
    [deck.name, draftTitle],
  );

  const startEditing = useCallback(() => {
    setIsEditing(true);
    setDraftTitle(deck.name);
  }, [deck.name]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setDraftTitle(deck.name);
  }, [deck.name]);

  const saveTitle = useCallback(async () => {
    if (!canSave) {
      setIsEditing(false);
      return;
    }

    const nextTitle = normalizeTitle(draftTitle);
    await updateDeck.mutateAsync({
      deckId: deck.id,
      published: deck.published,
      name: nextTitle,
    });
    onChanged();
    setIsEditing(false);
  }, [
    canSave,
    deck.id,
    deck.published,
    draftTitle,
    onChanged,
    updateDeck,
  ]);

  const confirmAndDelete = useCallback(async () => {
    const ok = confirm("Are you sure you want to delete this deck?");
    if (!ok) {
      return;
    }
    await deleteDeck.mutateAsync({ deckId: deck.id });
    onChanged();
  }, [deck.id, deleteDeck, onChanged]);

  const togglePublished = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const willPublish = event.currentTarget.checked;
      if (willPublish) {
        const ok = confirm("Are you sure you want to share this deck?");
        if (!ok) {
          event.currentTarget.checked = false;
          return;
        }
      }

      await updateDeck.mutateAsync({
        deckId: deck.id,
        published: willPublish,
        name: deck.name,
      });
      onChanged();
    },
    [deck.id, deck.name, onChanged, updateDeck],
  );

  return (
    <Card withBorder radius="md" p="md" bg="pink.0">
      <Group justify="space-between" align="center" wrap="nowrap">
        <Checkbox
          checked={isSelected}
          onChange={() => onToggleSelected(deck.id)}
          size="md"
        />

        {isEditing ? (
          <TextInput
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.currentTarget.value)}
            autoFocus
            variant="unstyled"
            styles={{ input: { fontWeight: 700, fontSize: "1.25rem" } }}
            style={{ flex: 1 }}
          />
        ) : (
          <Text fw={700} size="xl" style={{ flex: 1 }}>
            {deck.name}
          </Text>
        )}

        <Group gap="xs" wrap="nowrap">
          {isEditing ? (
            <>
              <ActionIcon
                variant="subtle"
                color="green"
                radius="xl"
                onClick={() => void saveTitle()}
                loading={updateDeck.isLoading}
                disabled={!canSave}
              >
                <IconCheck size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                radius="xl"
                onClick={cancelEditing}
                disabled={updateDeck.isLoading}
              >
                <IconX size={16} />
              </ActionIcon>
            </>
          ) : (
            <>
              <ActionIcon
                variant="subtle"
                color="blue"
                radius="xl"
                onClick={startEditing}
              >
                <IconPencil size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                radius="xl"
                onClick={() => void confirmAndDelete()}
                loading={deleteDeck.isLoading}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </>
          )}
        </Group>
      </Group>

      <Group justify="space-between" mt="sm">
        <Badge color={deck.quizzesDue > 0 ? "pink" : "gray"}>
          {deck.quizzesDue} Due
        </Badge>
        <Badge color={deck.newQuizzes > 0 ? "blue" : "gray"}>
          {deck.newQuizzes} New
        </Badge>
      </Group>

      <Stack gap="xs" mt="md">
        <Button
          component={Link}
          href={`/review/${deck.id}?take=${take}`}
          leftSection={<IconStars size={18} />}
          color="pink"
          radius="md"
          fullWidth
        >
          Study Cards
        </Button>

        <Button
          component={Link}
          href={`/speaking/${deck.id}`}
          leftSection={<IconMicrophone size={18} />}
          variant="light"
          color="pink"
          radius="md"
          fullWidth
        >
          Speaking Improvements
        </Button>

        <Button
          component={Link}
          href={`/writing/${deck.id}`}
          leftSection={<IconPencil size={18} />}
          variant="light"
          color="pink"
          radius="md"
          fullWidth
        >
          Writing Practice
        </Button>
      </Stack>

      <Switch
        mt="md"
        checked={deck.published}
        onChange={togglePublished}
        label="Published"
        disabled={updateDeck.isLoading}
      />
    </Card>
  );
}
