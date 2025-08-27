import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Pagination,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconFilter, IconTrash } from "@tabler/icons-react";
import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

const ITEMS_PER_PAGE = 5;

interface WritingHistory {
  submissions: {
    id: number;
    prompt: string;
    submission: string;
    correction: string;
    createdAt: string;
    deck: {
      id: number;
      name: string;
      langCode: string;
    };
  }[];
  totalPages: number;
  currentPage: number;
  statusMessage?: {
    type: "success" | "error";
    message: string;
  };
  decks: { id: number; name: string; langCode: string }[];
  q: string;
  deckId: number | null;
}

export const getServerSideProps: GetServerSideProps<
  WritingHistory
> = async (ctx) => {
  // Authenticate user
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  // Get filters from query params
  const toStr = (v: unknown) =>
    Array.isArray(v) ? v[0] : (v as string | undefined);
  const page = Number(toStr(ctx.query.page)) || 1;
  const q = toStr(ctx.query.q) ?? "";
  const deckIdRaw = toStr(ctx.query.deckId);
  const deckId = deckIdRaw ? Number(deckIdRaw) : null;
  const skip = (page - 1) * ITEMS_PER_PAGE;

  // Build where and get total count for pagination
  const where = {
    userId: dbUser.id,
    ...(deckId ? { deckId } : {}),
    ...(q
      ? {
          OR: [
            { prompt: { contains: q, mode: "insensitive" as const } },
            { submission: { contains: q, mode: "insensitive" as const } },
            { correction: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const totalCount = await prismaClient.writingSubmission.count({ where });

  // Fetch user's writing submissions with pagination
  const submissions = await prismaClient.writingSubmission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: ITEMS_PER_PAGE,
    skip,
    select: {
      id: true,
      prompt: true,
      submission: true,
      correction: true,
      createdAt: true,
      deck: {
        select: {
          id: true,
          name: true,
          langCode: true,
        },
      },
    },
  });

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Decks for filter options
  const decks = await prismaClient.deck.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, langCode: true },
  });

  return {
    props: {
      submissions: JSON.parse(JSON.stringify(submissions)),
      totalPages,
      currentPage: page,
      decks,
      q,
      deckId: deckId ?? null,
    },
  };
};

export default function WritingHistoryPage({
  submissions,
  totalPages,
  currentPage,
  decks,
  q,
  deckId,
}: WritingHistory) {
  const router = useRouter();
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [query, setQuery] = useState(q);
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    deckId ? String(deckId) : "",
  );

  const toggleItem = (id: number) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  const applyFilters = () => {
    router.push({
      pathname: "/writing",
      query: {
        page: 1,
        ...(query ? { q: query } : {}),
        ...(selectedDeckId ? { deckId: selectedDeckId } : {}),
      },
    });
  };

  const goToPage = (page: number) => {
    router.push({
      pathname: "/writing",
      query: {
        page,
        ...(query ? { q: query } : {}),
        ...(selectedDeckId ? { deckId: selectedDeckId } : {}),
      },
    });
  };

  const deckOptions = useMemo(
    () =>
      [{ value: "", label: "All decks" }].concat(
        decks.map((d) => ({
          value: String(d.id),
          label: `${d.name} (${d.langCode})`,
        })),
      ),
    [decks],
  );

  const formatDateISO = (iso: string) => iso.slice(0, 10);

  return (
    <Container size="md" py="md">
      <Title order={2}>My Writing History</Title>

      <Paper withBorder p="md" radius="md" mt="sm" mb="md">
        <Group align="flex-end" wrap="wrap">
          <TextInput
            label="Search"
            placeholder="Prompt, submission, or correction"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            style={{ minWidth: 260 }}
          />
          <Select
            label="Deck"
            value={selectedDeckId}
            onChange={(val) => setSelectedDeckId(val ?? "")}
            data={deckOptions}
            style={{ minWidth: 220 }}
          />
          <Group gap="sm">
            <Button
              leftSection={<IconFilter size={16} />}
              variant="light"
              onClick={applyFilters}
            >
              Apply
            </Button>
          </Group>
          <Group ml="auto">
            {totalPages > 1 && (
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={(p) => goToPage(p)}
              />
            )}
          </Group>
        </Group>
      </Paper>

      {submissions.length === 0 ? (
        <Alert title="No submissions found" color="blue">
          You haven't submitted any writing practice yet.{" "}
          <Link href="/create">Add a deck</Link> and{" "}
          <Link href="/review">do some writing exercises!</Link>
        </Alert>
      ) : (
        <Stack gap="xl">
          {submissions.map((submission) => (
            <Paper key={submission.id} p="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={5}>
                    <Text fw={700} size="lg">
                      {formatDateISO(submission.createdAt)}
                    </Text>
                    <Group gap="xs">
                      <Badge color="pink" variant="light">
                        {submission.deck.name}
                      </Badge>
                      <Badge variant="outline">
                        {submission.deck.langCode.toUpperCase()}
                      </Badge>
                    </Group>
                  </Stack>
                  <Tooltip label="Delete submission">
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => {
                        if (
                          confirm(
                            "Are you sure you want to delete this submission?",
                          )
                        ) {
                          void router.push({
                            pathname: "/writing/delete",
                            query: {
                              id: submission.id,
                              page: currentPage,
                            },
                          });
                        }
                      }}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>

                <Stack gap="xs">
                  <Text fw={600} size="sm">
                    Prompt:
                  </Text>
                  <Text size="sm" mb="xs">
                    {submission.prompt}
                  </Text>
                </Stack>

                <UnstyledButton
                  onClick={() => toggleItem(submission.id)}
                  styles={(theme) => ({
                    root: {
                      display: "block",
                      width: "100%",
                      textAlign: "center",
                      padding: theme.spacing.xs,
                      borderRadius: theme.radius.sm,
                      color: theme.colors.blue[6],
                      "&:hover": {
                        backgroundColor: theme.colors.gray[0],
                      },
                    },
                  })}
                >
                  {expandedItem === submission.id
                    ? "Hide Details"
                    : "Show Details"}
                </UnstyledButton>

                {expandedItem === submission.id && (
                  <Stack gap="md" mt="xs">
                    <Divider />

                    <Stack gap="xs">
                      <Text fw={600} size="sm">
                        Your Submission:
                      </Text>
                      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                        {submission.submission}
                      </Text>
                    </Stack>

                    <Stack gap="xs">
                      <Text fw={600} size="sm">
                        Corrected Text:
                      </Text>
                      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                        {submission.correction}
                      </Text>
                    </Stack>

                    <Stack gap="xs">
                      <Text fw={600} size="sm">
                        Changes:
                      </Text>
                      <VisualDiff
                        actual={submission.submission}
                        expected={submission.correction}
                      />
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}

          {totalPages > 1 && (
            <Group justify="center" mt="xl">
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={(p) => goToPage(p)}
              />
            </Group>
          )}
        </Stack>
      )}
    </Container>
  );
}
