import { DECK_DESCRIPTION_MAX_LENGTH } from "@/koala/decks/constants";
import {
  decksWithReviewInfo,
  DeckWithReviewInfo,
} from "@/koala/decks/decks-with-review-info";
import { getServersideUser } from "@/koala/get-serverside-user";
import { useUserSettings } from "@/koala/settings-provider";
import { clampReviewTake } from "@/koala/settings/review-take";
import { trpc } from "@/koala/trpc-config";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Grid,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import {
  IconCheck,
  IconGitMerge,
  IconPencil,
  IconPlus,
  IconStars,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next/types";
import { useCallback, useState } from "react";

type ReviewPageProps = {
  decks: DeckWithReviewInfo[];
};

type DeckTitleFieldProps = {
  isEditing: boolean;
  title: string;
  deckName: string;
  onChange: (value: string) => void;
};

function DeckTitleField({
  isEditing,
  title,
  deckName,
  onChange,
}: DeckTitleFieldProps) {
  if (isEditing) {
    return (
      <TextInput
        value={title}
        onChange={(e) => onChange(e.currentTarget.value)}
        autoFocus
        size="sm"
        aria-label="Deck name"
        styles={{ input: { fontWeight: 600 } }}
      />
    );
  }

  return (
    <Text fw={600} size="lg" c="gray.8">
      {deckName}
    </Text>
  );
}

type DeckActionButtonsProps = {
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
};

function DeckActionButtons({
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  isSaving,
  isDeleting,
}: DeckActionButtonsProps) {
  if (isEditing) {
    return (
      <Group gap="xs">
        <ActionIcon
          variant="light"
          color="green"
          onClick={onSave}
          disabled={isSaving}
          size="lg"
          aria-label="Save deck"
        >
          <IconCheck size={18} />
        </ActionIcon>
        <ActionIcon
          variant="light"
          color="red"
          onClick={onCancel}
          disabled={isSaving}
          size="lg"
          aria-label="Cancel edits"
        >
          <IconX size={18} />
        </ActionIcon>
      </Group>
    );
  }

  return (
    <Group gap="xs">
      <ActionIcon
        variant="light"
        color="pink"
        onClick={onEdit}
        size="lg"
        aria-label="Edit deck"
      >
        <IconPencil size={18} />
      </ActionIcon>
      <ActionIcon
        variant="light"
        color="red"
        onClick={onDelete}
        disabled={isDeleting}
        size="lg"
        aria-label="Delete deck"
      >
        <IconTrash size={18} />
      </ActionIcon>
    </Group>
  );
}

type DeckCardHeaderProps = {
  isSelected: boolean;
  onToggleSelected: () => void;
  isEditing: boolean;
  title: string;
  deckName: string;
  description: string;
  onTitleChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
};

function DeckCardHeader({
  isSelected,
  onToggleSelected,
  isEditing,
  title,
  deckName,
  description,
  onTitleChange,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  isSaving,
  isDeleting,
}: DeckCardHeaderProps) {
  const trimmedDescription = description.trim();
  const hasDescription = trimmedDescription.length > 0;
  const showDescription = !isEditing && hasDescription;

  return (
    <Group align="flex-start" justify="space-between" wrap="wrap">
      <Group align="flex-start" gap="sm" wrap="nowrap" style={{ flex: 1 }}>
        <Checkbox
          checked={isSelected}
          onChange={onToggleSelected}
          size="sm"
          mt={4}
          aria-label={`Select ${deckName}`}
        />
        <Box style={{ flex: 1 }}>
          <DeckTitleField
            isEditing={isEditing}
            title={title}
            deckName={deckName}
            onChange={onTitleChange}
          />
          {showDescription && (
            <Text size="sm" c="gray.7" mt={4}>
              {trimmedDescription}
            </Text>
          )}
        </Box>
      </Group>
      <DeckActionButtons
        isEditing={isEditing}
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
        onDelete={onDelete}
        isSaving={isSaving}
        isDeleting={isDeleting}
      />
    </Group>
  );
}

type DeckDescriptionFieldProps = {
  description: string;
  onChange: (value: string) => void;
};

function DeckDescriptionField({
  description,
  onChange,
}: DeckDescriptionFieldProps) {
  return (
    <Stack gap={4}>
      <Textarea
        label="Description"
        value={description}
        onChange={(e) => onChange(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={4}
        maxLength={DECK_DESCRIPTION_MAX_LENGTH}
      />
      <Text size="xs" c="dimmed" ta="right">
        {description.length}/{DECK_DESCRIPTION_MAX_LENGTH} characters
      </Text>
    </Stack>
  );
}

type DeckStatsProps = {
  quizzesDue: number;
  newQuizzes: number;
};

type DeckFooterProps = DeckStatsProps & {
  deckId: number;
  takeCount: number;
};

function DeckFooter({
  deckId,
  quizzesDue,
  newQuizzes,
  takeCount,
}: DeckFooterProps) {
  return (
    <Group justify="space-between" align="center" gap="sm" wrap="wrap">
      <Group gap="xs">
        <Badge color="pink" variant="light" radius="md">
          {quizzesDue} due
        </Badge>
        <Badge color="gray" variant="light" radius="md">
          {newQuizzes} new
        </Badge>
      </Group>
      <Button
        component={Link}
        href={`/review/${deckId}?take=${takeCount}`}
        leftSection={<IconStars size={16} />}
        color="pink"
        variant="light"
        size="sm"
      >
        Study Cards
      </Button>
    </Group>
  );
}

export const getServerSideProps: GetServerSideProps<
  ReviewPageProps
> = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const decks = await decksWithReviewInfo(dbUser.id);

  return {
    props: {
      decks,
    },
  };
};

export default function ReviewPage({ decks }: ReviewPageProps) {
  const router = useRouter();
  const [selectedDeckIds, setSelectedDeckIds] = useState<number[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const userSettings = useUserSettings();
  const reviewTakeCount = clampReviewTake(userSettings.reviewTakeCount);

  const mergeDecks = trpc.mergeDecks.useMutation({
    onSuccess: () => {
      setSelectedDeckIds([]);
      refreshData();
    },
    onError: (error) => {
      setMergeError(error.message);
    },
  });

  const refreshData = () => {
    router.replace(router.asPath);
  };

  const handleToggleDeckSelection = (deckId: number) => {
    setSelectedDeckIds((prev) =>
      prev.includes(deckId)
        ? prev.filter((id) => id !== deckId)
        : [...prev, deckId],
    );
  };

  const handleMergeDecks = async () => {
    if (selectedDeckIds.length < 2) {
      setMergeError("Please select at least 2 decks to merge");
      return;
    }

    setIsMerging(true);
    try {
      const firstSelectedDeck = decks.find(
        (deck) => deck.id === selectedDeckIds[0],
      );
      if (!firstSelectedDeck) {
        throw new Error("Could not find the first selected deck");
      }

      await mergeDecks.mutateAsync({
        deckIds: selectedDeckIds,
        newDeckName: `${firstSelectedDeck.name} (Merged)`,
      });

      setMergeError(null);
    } finally {
      setIsMerging(false);
    }
  };

  function DeckCard({ deck }: { deck: DeckWithReviewInfo }) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(deck.name);
    const [description, setDescription] = useState(deck.description ?? "");
    const updateDeckMutation = trpc.updateDeck.useMutation();
    const deleteDeckMutation = trpc.deleteDeck.useMutation();
    const isSelected = selectedDeckIds.includes(deck.id);

    const handleEdit = useCallback(() => setIsEditing(true), []);
    const handleCancel = useCallback(() => {
      setIsEditing(false);
      setTitle(deck.name);
      setDescription(deck.description ?? "");
    }, [deck.description, deck.name]);

    const handleSave = useCallback(async () => {
      const trimmedTitle = title.trim();
      const normalizedTitle = trimmedTitle || deck.name;
      const normalizedDescription = description.trim();
      const descriptionValue =
        normalizedDescription.length > 0 ? normalizedDescription : null;
      const nameChanged = normalizedTitle !== deck.name;
      const descriptionChanged =
        descriptionValue !== (deck.description ?? null);
      if (nameChanged || descriptionChanged) {
        await updateDeckMutation.mutateAsync({
          deckId: deck.id,
          name: normalizedTitle,
          description: descriptionValue,
        });
        refreshData();
      }
      setTitle(normalizedTitle);
      setDescription(descriptionValue ?? "");
      setIsEditing(false);
    }, [
      deck.description,
      deck.id,
      deck.name,
      description,
      title,
      updateDeckMutation,
    ]);

    const handleDelete = useCallback(async () => {
      if (!confirm("Are you sure you want to delete this deck?")) {
        return;
      }
      await deleteDeckMutation.mutateAsync({ deckId: deck.id });
      refreshData();
    }, [deck.id, deleteDeckMutation]);

    return (
      <Card withBorder p="sm">
        <Stack gap="sm">
          <DeckCardHeader
            isSelected={isSelected}
            onToggleSelected={() => handleToggleDeckSelection(deck.id)}
            isEditing={isEditing}
            title={title}
            deckName={deck.name}
            description={description}
            onTitleChange={setTitle}
            onEdit={handleEdit}
            onSave={handleSave}
            onCancel={handleCancel}
            onDelete={handleDelete}
            isSaving={updateDeckMutation.isLoading}
            isDeleting={deleteDeckMutation.isLoading}
          />
          {isEditing && (
            <DeckDescriptionField
              description={description}
              onChange={setDescription}
            />
          )}
          <DeckFooter
            quizzesDue={deck.quizzesDue}
            newQuizzes={deck.newQuizzes}
            deckId={deck.id}
            takeCount={reviewTakeCount}
          />
        </Stack>
      </Card>
    );
  }

  function NoDecksMessage() {
    return (
      <Container size="md" py="xl">
        <Stack align="center" gap="xs" mb="xl">
          <Title order={2} c="pink.7" ta="center">
            Welcome to Koala Cards 🌸
          </Title>
          <Text size="md" c="gray.7" ta="center">
            Start your learning journey by adding some cards.
          </Text>
        </Stack>
        <Card withBorder p="xl" radius="md">
          <Stack align="center" gap="md">
            <Button
              component={Link}
              href="/create"
              leftSection={<IconPlus size={18} />}
              color="pink"
              variant="light"
              size="md"
            >
              Add Your First Cards
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (decks.length === 0) {
    return <NoDecksMessage />;
  }

  const sortedDecks = [...decks].sort(
    (a, b) => b.quizzesDue - a.quizzesDue,
  );

  return (
    <Container size="lg" py="md">
      <Stack gap="xs" mb="lg">
        <Title order={2} c="pink.7">
          Your Decks
        </Title>
        <Text size="md" c="gray.7">
          Choose a deck to start studying
        </Text>
      </Stack>

      {selectedDeckIds.length >= 2 && (
        <Card withBorder p="sm" mb="md">
          <Group
            justify="space-between"
            align="center"
            gap="sm"
            wrap="wrap"
          >
            <Group gap="xs">
              <Badge color="pink" variant="light" radius="md">
                {selectedDeckIds.length} selected
              </Badge>
              <Text size="sm" c="gray.7">
                Merge selected decks into one
              </Text>
            </Group>
            <Button
              leftSection={<IconGitMerge size={16} />}
              color="pink"
              onClick={handleMergeDecks}
              loading={isMerging}
            >
              Merge Decks
            </Button>
          </Group>

          {mergeError && (
            <Alert
              color="red"
              title="Error"
              mb="md"
              radius="md"
              withCloseButton
              onClose={() => setMergeError(null)}
            >
              {mergeError}
            </Alert>
          )}
        </Card>
      )}

      <Grid gutter="md">
        {sortedDecks.map((deck) => (
          <Grid.Col key={deck.id} span={{ base: 12, md: 6 }}>
            <DeckCard deck={deck} />
          </Grid.Col>
        ))}
      </Grid>
    </Container>
  );
}
