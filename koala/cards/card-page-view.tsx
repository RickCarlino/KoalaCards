import { timeUntil } from "@/koala/time-until";
import { trpc } from "@/koala/trpc-config";
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
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import type { CardPageProps } from "@/koala/cards/card-page-types";

type CardEditValues = {
  term: string;
  definition: string;
  flagged: boolean;
};

function formatReviewTime(timestamp: number, emptyLabel: string) {
  return timestamp > 0 ? timeUntil(timestamp) : emptyLabel;
}

function Stat(props: {
  label: string;
  value: string | number;
  icon?: ReactNode;
}) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group wrap="nowrap" gap="sm" align="center">
        {props.icon}
        <Stack gap={2} style={{ flex: 1 }}>
          <Text size="xs" c="dimmed">
            {props.label}
          </Text>
          <Text fw={600}>{props.value}</Text>
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
  onSave: (values: CardEditValues) => Promise<void>;
  onBack: () => void;
  onDelete: () => Promise<void>;
}) {
  const form = useForm<CardEditValues>({
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
            {...form.getInputProps("flagged", { type: "checkbox" })}
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

type StatSpec = {
  label: string;
  value: string | number;
  icon: ReactNode;
};

function buildSchedulingStats(params: {
  repetitions: number;
  lapses: number;
  lastReview: number;
  nextReview: number;
  stability: number;
  difficulty: number;
}): StatSpec[] {
  return [
    {
      label: "Repetitions",
      value: params.repetitions,
      icon: <IconRepeat size={18} />,
    },
    {
      label: "Lapses",
      value: params.lapses,
      icon: <IconFlame size={18} />,
    },
    {
      label: "Last Review",
      value: formatReviewTime(params.lastReview, "never"),
      icon: <IconClock size={18} />,
    },
    {
      label: "Next Review",
      value: formatReviewTime(params.nextReview, "not scheduled"),
      icon: <IconClock size={18} />,
    },
    {
      label: "Stability",
      value: params.stability.toFixed(2),
      icon: <IconTrendingUp size={18} />,
    },
    {
      label: "Difficulty",
      value: params.difficulty.toFixed(2),
      icon: <IconTrendingUp size={18} />,
    },
  ];
}

function CardScheduling(props: {
  repetitions: number;
  lapses: number;
  lastReview: number;
  nextReview: number;
  stability: number;
  difficulty: number;
}) {
  const stats = buildSchedulingStats(props);

  return (
    <Paper withBorder p="lg" radius="md" mt="md">
      <Title order={5} mb="sm">
        Scheduling
      </Title>
      <Grid gutter="sm">
        {stats.map((stat) => (
          <Grid.Col key={stat.label} span={{ base: 12, sm: 6 }}>
            <Stat label={stat.label} value={stat.value} icon={stat.icon} />
          </Grid.Col>
        ))}
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
  const deckName = props.deckName || "—";
  const language = props.langCode.toUpperCase();

  const MetaRow = (row: { label: string; value: string }) => (
    <Group gap="xs">
      <Text c="dimmed" size="sm">
        {row.label}
      </Text>
      <Text size="sm" fw={500}>
        {row.value}
      </Text>
    </Group>
  );

  return (
    <Paper withBorder p="lg" radius="md" mt="md">
      <Title order={5} mb="sm">
        Metadata
      </Title>
      <Stack gap={6}>
        <MetaRow label="Deck:" value={deckName} />
        <MetaRow label="Language:" value={language} />
        <MetaRow label="Gender:" value={props.gender} />
      </Stack>
    </Paper>
  );
}

export function CardPageView({ card }: CardPageProps) {
  const router = useRouter();
  const updateMutation = trpc.editCard.useMutation();
  const deleteMutation = trpc.deleteCard.useMutation();

  const handleSave = async (values: CardEditValues) => {
    await updateMutation.mutateAsync({ id: card.id, ...values });
    router.back();
  };

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
              onBack={() => router.back()}
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
