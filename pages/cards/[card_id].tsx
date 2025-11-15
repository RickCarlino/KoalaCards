import { getCardOrFail } from "@/koala/get-card-or-fail";
import { getServersideUser } from "@/koala/get-serverside-user";
import { maybeGetCardImageUrl } from "@/koala/image";
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
import { GetServerSideProps } from "next";
import { prismaClient } from "@/koala/prisma-client";
import { useRouter } from "next/router";

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

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
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

function CardEditor({ card }: CardPageProps) {
  const router = useRouter();
  const form = useForm<{
    term: string;
    definition: string;
    flagged: boolean;
  }>({
    initialValues: {
      term: card.term,
      definition: card.definition,
      flagged: card.flagged,
    },
  });

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
          <Group>
            <Badge color="pink" variant="light">
              {card.langCode.toUpperCase()}
            </Badge>
            <Badge variant="outline">Gender: {card.gender}</Badge>
            {card.flagged && (
              <Badge color="red" leftSection={<IconFlag size={14} />}>
                Paused
              </Badge>
            )}
          </Group>
        </Group>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper withBorder p="lg" radius="md" shadow="xs">
              <Title order={4} mb="sm">
                Edit Card
              </Title>
              <form onSubmit={form.onSubmit(handleSave)}>
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
                      <Button
                        variant="default"
                        onClick={() => router.back()}
                      >
                        Back
                      </Button>
                      <Button
                        variant="outline"
                        color="red"
                        onClick={handleDelete}
                      >
                        Delete Card
                      </Button>
                    </Group>
                  </Group>
                </Stack>
              </form>
            </Paper>

            <Paper withBorder p="lg" radius="md" mt="md">
              <Title order={5} mb="sm">
                Scheduling
              </Title>
              <Grid gutter="sm">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stat
                    label="Repetitions"
                    value={card.repetitions}
                    icon={<IconRepeat size={18} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stat
                    label="Lapses"
                    value={card.lapses}
                    icon={<IconFlame size={18} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stat
                    label="Last Review"
                    value={
                      card.lastReview
                        ? timeUntil(card.lastReview)
                        : "never"
                    }
                    icon={<IconClock size={18} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stat
                    label="Next Review"
                    value={
                      card.nextReview
                        ? timeUntil(card.nextReview)
                        : "not scheduled"
                    }
                    icon={<IconClock size={18} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stat
                    label="Stability"
                    value={card.stability.toFixed(2)}
                    icon={<IconTrendingUp size={18} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stat
                    label="Difficulty"
                    value={card.difficulty.toFixed(2)}
                    icon={<IconTrendingUp size={18} />}
                  />
                </Grid.Col>
              </Grid>
              <Divider my="md" />
              <Text size="sm" c="dimmed">
                Scheduling data uses FSRS-based fields migrated onto the
                card. Edits are read-only here.
              </Text>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <Paper withBorder p="lg" radius="md" shadow="xs">
              <Title order={4} mb="sm">
                Illustration
              </Title>
              {card.imageURL ? (
                <Image
                  src={card.imageURL}
                  alt="Card illustration"
                  radius="md"
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No image available for this card.
                </Text>
              )}
            </Paper>

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
                    {card.deckName || "—"}
                  </Text>
                </Group>
                <Group gap="xs">
                  <Text c="dimmed" size="sm">
                    Language:
                  </Text>
                  <Text size="sm" fw={500}>
                    {card.langCode.toUpperCase()}
                  </Text>
                </Group>
                <Group gap="xs">
                  <Text c="dimmed" size="sm">
                    Gender:
                  </Text>
                  <Text size="sm" fw={500}>
                    {card.gender}
                  </Text>
                </Group>
              </Stack>
            </Paper>
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
  const { card_id } = context.query;
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    } as const;
  }

  const cardId = parseInt(card_id as string, 10);
  const card = await getCardOrFail(cardId, dbUser.id);
  const imageURL = (await maybeGetCardImageUrl(card.imageBlobId)) || null;
  const deck = card.deckId
    ? await prismaClient.deck.findFirst({
        where: { id: card.deckId, userId: dbUser.id },
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
        langCode: "ko",
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
