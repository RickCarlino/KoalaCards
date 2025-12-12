import { getCardOrFail } from "@/koala/get-card-or-fail";
import { getServersideUser } from "@/koala/get-serverside-user";
import { maybeGetCardImageUrl } from "@/koala/image";
import { prismaClient } from "@/koala/prisma-client";
import { DEFAULT_LANG_CODE } from "@/koala/shared-types";
import { timeUntil } from "@/koala/time-until";
import { trpc } from "@/koala/trpc-config";
import {
  firstQueryValue,
  toPositiveIntOrNull,
} from "@/koala/utils/query-params";
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Divider,
  Grid,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconClock,
  IconFlag,
  IconFlame,
  IconRepeat,
  IconTrendingUp,
} from "@tabler/icons-react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

type CardView = {
  id: number;
  term: string;
  definition: string;
  flagged: boolean;
  langCode: string;
  gender: string;
  imageURL: string | null;
  repetitions: number;
  lapses: number;
  lastReview: number;
  nextReview: number;
  stability: number;
  difficulty: number;
  deckName: string | null;
};

type CardPageProps = {
  card: CardView;
};

function formatReviewTime(timestamp: number, emptyLabel: string) {
  return timestamp > 0 ? timeUntil(timestamp) : emptyLabel;
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
}) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group wrap="nowrap" gap="sm" align="center">
        {icon}
        <Stack gap={2} style={{ flex: 1 }}>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          <Text fw={600}>{value}</Text>
        </Stack>
      </Group>
    </Paper>
  );
}

function CardBadges(props: {
  langCode: string;
  gender: string;
  flagged: boolean;
}) {
  return (
    <Group>
      <Badge color="pink" variant="light">
        {props.langCode.toUpperCase()}
      </Badge>
      <Badge variant="outline">Gender: {props.gender}</Badge>
      {props.flagged ? (
        <Badge color="red" leftSection={<IconFlag size={14} />}>
          Paused
        </Badge>
      ) : null}
    </Group>
  );
}

function CardEditForm(props: {
  term: string;
  definition: string;
  flagged: boolean;
  onSave: (values: {
    term: string;
    definition: string;
    flagged: boolean;
  }) => Promise<void>;
  onBack: () => void;
  onDelete: () => Promise<void>;
}) {
  const form = useForm<{
    term: string;
    definition: string;
    flagged: boolean;
  }>({
    initialValues: {
      term: props.term,
      definition: props.definition,
      flagged: props.flagged,
    },
  });

  return (
    <Paper withBorder p="lg" radius="md" shadow="xs">
      <Title order={4} mb="sm">
        Edit Card
      </Title>
      <form onSubmit={form.onSubmit(props.onSave)}>
        <Stack gap="md">
          <TextInput
            label="Term"
            placeholder="Enter the term"
            {...form.getInputProps("term")}
          />
          <TextInput
            label="Definition"
            placeholder="Enter the definition"
            {...form.getInputProps("definition")}
          />
          <Checkbox
            label="Pause reviews of this card"
            {...form.getInputProps("flagged", {
              type: "checkbox",
            })}
          />

          <Group justify="space-between" mt="sm">
            <Button type="submit">Save Changes</Button>
            <Group gap="sm">
              <Button variant="default" onClick={props.onBack}>
                Back
              </Button>
              <Button
                variant="outline"
                color="red"
                onClick={props.onDelete}
              >
                Delete Card
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}

function CardScheduling(props: {
  repetitions: number;
  lapses: number;
  lastReview: number;
  nextReview: number;
  stability: number;
  difficulty: number;
}) {
  return (
    <Paper withBorder p="lg" radius="md" mt="md">
      <Title order={5} mb="sm">
        Scheduling
      </Title>
      <Grid gutter="sm">
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Stat
            label="Repetitions"
            value={props.repetitions}
            icon={<IconRepeat size={18} />}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Stat
            label="Lapses"
            value={props.lapses}
            icon={<IconFlame size={18} />}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Stat
            label="Last Review"
            value={formatReviewTime(props.lastReview, "never")}
            icon={<IconClock size={18} />}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Stat
            label="Next Review"
            value={formatReviewTime(props.nextReview, "not scheduled")}
            icon={<IconClock size={18} />}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Stat
            label="Stability"
            value={props.stability.toFixed(2)}
            icon={<IconTrendingUp size={18} />}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Stat
            label="Difficulty"
            value={props.difficulty.toFixed(2)}
            icon={<IconTrendingUp size={18} />}
          />
        </Grid.Col>
      </Grid>
      <Divider my="md" />
      <Text size="sm" c="dimmed">
        Scheduling data uses FSRS-based fields migrated onto the card.
        Edits are read-only here.
      </Text>
    </Paper>
  );
}

function CardIllustration(props: { imageURL: string | null }) {
  return (
    <Paper withBorder p="lg" radius="md" shadow="xs">
      <Title order={4} mb="sm">
        Illustration
      </Title>
      {props.imageURL ? (
        <Image src={props.imageURL} alt="Card illustration" radius="md" />
      ) : (
        <Text size="sm" c="dimmed">
          No image available for this card.
        </Text>
      )}
    </Paper>
  );
}

function CardMetadata(props: {
  deckName: string | null;
  langCode: string;
  gender: string;
}) {
  return (
    <Paper withBorder p="lg" radius="md" mt="md">
      <Title order={5} mb="sm">
        Metadata
      </Title>
      <Stack gap={6}>
        <Group gap="xs">
          <Text c="dimmed" size="sm">
            Deck:
          </Text>
          <Text size="sm" fw={500}>
            {props.deckName || "—"}
          </Text>
        </Group>
        <Group gap="xs">
          <Text c="dimmed" size="sm">
            Language:
          </Text>
          <Text size="sm" fw={500}>
            {props.langCode.toUpperCase()}
          </Text>
        </Group>
        <Group gap="xs">
          <Text c="dimmed" size="sm">
            Gender:
          </Text>
          <Text size="sm" fw={500}>
            {props.gender}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}

function CardEditor({ card }: CardPageProps) {
  const router = useRouter();
  const updateMutation = trpc.editCard.useMutation();
  const deleteMutation = trpc.deleteCard.useMutation();

  const handleSave = async (values: {
    term: string;
    definition: string;
    flagged: boolean;
  }) => {
    await updateMutation.mutateAsync({ id: card.id, ...values });
    router.back();
  };

  const handleBack = () => router.back();

  const handleDelete = async () => {
    if (!confirm("Delete this card? This cannot be undone.")) {
      return;
    }
    await deleteMutation.mutateAsync({ id: card.id });
    router.back();
  };

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={2}>{card.term}</Title>
          <CardBadges
            langCode={card.langCode}
            gender={card.gender}
            flagged={card.flagged}
          />
        </Group>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <CardEditForm
              term={card.term}
              definition={card.definition}
              flagged={card.flagged}
              onSave={handleSave}
              onBack={handleBack}
              onDelete={handleDelete}
            />
            <CardScheduling
              repetitions={card.repetitions}
              lapses={card.lapses}
              lastReview={card.lastReview}
              nextReview={card.nextReview}
              stability={card.stability}
              difficulty={card.difficulty}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <CardIllustration imageURL={card.imageURL} />
            <CardMetadata
              deckName={card.deckName}
              langCode={card.langCode}
              gender={card.gender}
            />
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}

export default function CardPage({ card }: CardPageProps) {
  return <CardEditor card={card} />;
}

export const getServerSideProps: GetServerSideProps<
  CardPageProps
> = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    } as const;
  }

  const cardId = toPositiveIntOrNull(
    firstQueryValue(context.query.card_id),
  );
  if (!cardId) {
    return { notFound: true } as const;
  }

  const card = await getCardOrFail(cardId, dbUser.id);
  const imageURL = (await maybeGetCardImageUrl(card.imageBlobId)) || null;
  const deckId = card.deckId;
  const deck = deckId
    ? await prismaClient.deck.findFirst({
        where: { id: deckId, userId: dbUser.id },
        select: { name: true },
      })
    : null;

  return {
    props: {
      card: {
        id: card.id,
        term: card.term,
        definition: card.definition,
        flagged: card.flagged,
        langCode: DEFAULT_LANG_CODE,
        gender: card.gender,
        imageURL,
        repetitions: card.repetitions ?? 0,
        lapses: card.lapses ?? 0,
        lastReview: card.lastReview ?? 0,
        nextReview: card.nextReview ?? 0,
        stability: card.stability ?? 0,
        difficulty: card.difficulty ?? 0,
        deckName: deck?.name || null,
      },
    },
  };
};
