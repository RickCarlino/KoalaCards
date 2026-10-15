import { getCardOrFail } from "@/koala/get-card-or-fail";
import { getServersideUser } from "@/koala/get-serverside-user";
import { maybeGetCardImageUrl } from "@/koala/image";
import { timeUntil } from "@/koala/time-until";
import { trpc } from "@/koala/trpc-config";
import {
  Anchor,
  Alert,
  Badge,
  Button,
  Checkbox,
  Container,
  Grid,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  Textarea,
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
import Link from "next/link";

type CardView = {
  id: number;
  deckId: number;
  term: string;
  definition: string;
  paused: boolean;
  langCode: string;
  imageURL: string | null;
  repetitions: number;
  lapses: number;
  lastReview: number;
  nextReview: number;
  stability: number;
  difficulty: number;
  deckName: string;
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
    <Group wrap="nowrap" gap="sm" align="center" py="xs">
      {icon}
      <Stack gap={2} miw={0} style={{ flex: 1 }}>
        <Text size="xs" c="pastel.6">
          {label}
        </Text>
        <Text fw={600}>{value}</Text>
      </Stack>
    </Group>
  );
}

function DeckLabel({
  deckId,
  deckName,
}: {
  deckId: number;
  deckName: string;
}) {
  return (
    <Anchor
      component={Link}
      href={`/cards?deckId=${deckId}`}
      size="sm"
      fw={500}
    >
      {deckName}
    </Anchor>
  );
}

function CardEditor({ card }: CardPageProps) {
  const router = useRouter();
  const form = useForm<{
    term: string;
    definition: string;
    paused: boolean;
  }>({
    initialValues: {
      term: card.term,
      definition: card.definition,
      paused: card.paused,
    },
  });

  const updateMutation = trpc.editCard.useMutation();
  const deleteMutation = trpc.deleteCard.useMutation();

  const handleSave = (values: {
    term: string;
    definition: string;
    paused: boolean;
  }) => {
    updateMutation.mutate(
      { id: card.id, ...values },
      { onSuccess: () => router.back() },
    );
  };

  const handleDelete = () => {
    if (!confirm("Delete this card? This cannot be undone.")) {
      return;
    }
    deleteMutation.mutate(
      { id: card.id },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Stack gap={4} miw={0} style={{ flex: "1 1 240px" }}>
            <Title order={1} size="h2">
              Edit card
            </Title>
            <Group gap="xs">
              <Text c="pastel.6" size="sm">
                Deck:
              </Text>
              <DeckLabel deckId={card.deckId} deckName={card.deckName} />
            </Group>
          </Stack>
          <Group>
            <Badge color="pink" variant="light">
              {card.langCode.toUpperCase()}
            </Badge>
            {card.paused && (
              <Badge color="red" leftSection={<IconFlag size={14} />}>
                Paused
              </Badge>
            )}
          </Group>
        </Group>

        <Grid gap="md">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper withBorder p="lg" radius="md" shadow="xs">
              <form onSubmit={form.onSubmit(handleSave)}>
                <Stack gap="md">
                  <Textarea
                    label="Term"
                    lang="ko"
                    autosize
                    minRows={2}
                    maxRows={6}
                    placeholder="Enter the term"
                    {...form.getInputProps("term")}
                  />
                  <Textarea
                    label="Definition"
                    autosize
                    minRows={2}
                    maxRows={6}
                    placeholder="Enter the definition"
                    {...form.getInputProps("definition")}
                  />
                  <Checkbox
                    label="Pause reviews of this card"
                    {...form.getInputProps("paused", {
                      type: "checkbox",
                    })}
                  />

                  {(updateMutation.isError || deleteMutation.isError) && (
                    <Alert color="red" role="alert">
                      {updateMutation.isError
                        ? "Couldn't save the card. Try again."
                        : "Couldn't delete the card. Try again."}
                    </Alert>
                  )}
                  <Group justify="space-between" mt="sm">
                    <Button
                      type="submit"
                      variant="filled"
                      loading={updateMutation.isPending}
                      disabled={deleteMutation.isPending}
                    >
                      Save changes
                    </Button>
                    <Group gap="sm">
                      <Button
                        variant="light"
                        color="gray"
                        onClick={() => router.back()}
                      >
                        Back
                      </Button>
                      <Button
                        variant="outline"
                        color="red"
                        onClick={handleDelete}
                        loading={deleteMutation.isPending}
                        disabled={updateMutation.isPending}
                      >
                        Delete card
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
              <Grid gap="sm">
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
                <Text size="sm" c="pastel.6">
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
                  <Text c="pastel.6" size="sm">
                    Deck:
                  </Text>
                  <DeckLabel
                    deckId={card.deckId}
                    deckName={card.deckName}
                  />
                </Group>
                <Group gap="xs">
                  <Text c="pastel.6" size="sm">
                    Language:
                  </Text>
                  <Text size="sm" fw={500}>
                    {card.langCode.toUpperCase()}
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
  if (card.deckId === null) {
    throw new Error("Card is missing a deck");
  }
  const deckId = card.deckId;
  const deck = await prismaClient.deck.findFirstOrThrow({
    where: { id: deckId, userId: dbUser.id },
    select: { name: true },
  });

  return {
    props: {
      card: {
        id: card.id,
        deckId,
        term: card.term,
        definition: card.definition,
        paused: card.paused,
        langCode: "ko",
        imageURL,
        repetitions: card.repetitions ?? 0,
        lapses: card.lapses ?? 0,
        lastReview: card.lastReview ?? 0,
        nextReview: card.nextReview ?? 0,
        stability: card.stability ?? 0,
        difficulty: card.difficulty ?? 0,
        deckName: deck.name,
      },
    },
  };
};
