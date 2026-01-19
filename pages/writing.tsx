import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Collapse,
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
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronUp,
  IconFilter,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
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
    } | null;
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

type WritingSubmission = WritingHistory["submissions"][number];

type DeckOption = {
  value: string;
  label: string;
};

export const getServerSideProps: GetServerSideProps<
  WritingHistory
> = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const toStr = (v: unknown) =>
    Array.isArray(v) ? v[0] : (v as string | undefined);
  const page = Number(toStr(ctx.query.page)) || 1;
  const q = toStr(ctx.query.q) ?? "";
  const deckIdRaw = toStr(ctx.query.deckId);
  const deckId = deckIdRaw ? Number(deckIdRaw) : null;
  const skip = (page - 1) * ITEMS_PER_PAGE;

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

  const submissionsRaw = await prismaClient.writingSubmission.findMany({
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
        },
      },
    },
  });
  const submissions = submissionsRaw.map((s) => ({
    ...s,
    deck: s.deck ? { ...s.deck, langCode: "ko" } : null,
  }));

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const decksRaw = await prismaClient.deck.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });
  const decks = decksRaw.map((d) => ({ ...d, langCode: "ko" }));

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

const formatDateISO = (iso: string) => iso.slice(0, 10);

const buildDeckOptions = (decks: WritingHistory["decks"]): DeckOption[] =>
  [{ value: "", label: "All decks" }].concat(
    decks.map((deck) => ({
      value: String(deck.id),
      label: `${deck.name} (${deck.langCode})`,
    })),
  );

type FiltersPanelProps = {
  query: string;
  selectedDeckId: string;
  deckOptions: DeckOption[];
  onQueryChange: (value: string) => void;
  onDeckChange: (value: string | null) => void;
  onApply: () => void;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
};

function FiltersPanel({
  query,
  selectedDeckId,
  deckOptions,
  onQueryChange,
  onDeckChange,
  onApply,
  totalPages,
  currentPage,
  onPageChange,
}: FiltersPanelProps) {
  const showPagination = totalPages > 1;

  return (
    <Paper withBorder p="md" radius="md" mb="md">
      <Stack gap="sm">
        <Group align="flex-end" wrap="wrap" gap="md">
          <TextInput
            label="Search"
            placeholder="Prompt, submission, or correction"
            value={query}
            onChange={(e) => onQueryChange(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 240 }}
          />
          <Select
            label="Deck"
            value={selectedDeckId}
            onChange={onDeckChange}
            data={deckOptions}
            style={{ minWidth: 220 }}
          />
          <Group ml="auto">
            <Button
              leftSection={<IconFilter size={16} />}
              variant="light"
              onClick={onApply}
            >
              Apply
            </Button>
          </Group>
        </Group>
        {showPagination && (
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              Page {currentPage} of {totalPages}
            </Text>
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={onPageChange}
            />
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

type SubmissionCardProps = {
  submission: WritingSubmission;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
};

function SubmissionCard({
  submission,
  isExpanded,
  onToggle,
  onDelete,
}: SubmissionCardProps) {
  const detailsId = `writing-details-${submission.id}`;
  const toggleLabel = isExpanded ? "Hide details" : "Show details";
  const toggleIcon = isExpanded ? (
    <IconChevronUp size={14} />
  ) : (
    <IconChevronDown size={14} />
  );

  return (
    <Card withBorder p="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Text fw={600} size="sm" c="gray.8">
              {formatDateISO(submission.createdAt)}
            </Text>
          </Stack>
          <Group gap="xs">
            <Button
              variant="subtle"
              size="xs"
              color="pink"
              onClick={onToggle}
              rightSection={toggleIcon}
              aria-expanded={isExpanded}
              aria-controls={detailsId}
            >
              {toggleLabel}
            </Button>
            <Tooltip label="Delete submission">
              <ActionIcon
                color="red"
                variant="light"
                onClick={onDelete}
                aria-label="Delete submission"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Box>
          <Text size="xs" c="dimmed" fw={600}>
            Prompt
          </Text>
          <Text size="sm" c="gray.8">
            {submission.prompt}
          </Text>
        </Box>

        <Collapse in={isExpanded}>
          <Box id={detailsId}>
            <Divider my="sm" />
            <Stack gap="sm">
              <Stack gap={4}>
                <Text size="xs" c="dimmed" fw={600}>
                  Your submission
                </Text>
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {submission.submission}
                </Text>
              </Stack>

              <Stack gap={4}>
                <Text size="xs" c="dimmed" fw={600}>
                  Corrected text
                </Text>
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {submission.correction}
                </Text>
              </Stack>

              <Stack gap={4}>
                <Text size="xs" c="dimmed" fw={600}>
                  Changes
                </Text>
                <VisualDiff
                  actual={submission.submission}
                  expected={submission.correction}
                />
              </Stack>
            </Stack>
          </Box>
        </Collapse>
      </Stack>
    </Card>
  );
}

type EmptyStateProps = {
  hasFilters: boolean;
};

function EmptyState({ hasFilters }: EmptyStateProps) {
  const title = hasFilters
    ? "No submissions match your filters"
    : "No writing submissions yet";
  const description = hasFilters
    ? "Try adjusting your search or start a new writing session."
    : "Start a writing session to see feedback here.";

  return (
    <Card withBorder p="lg">
      <Stack align="center" gap="sm">
        <Title order={3} c="pink.7" ta="center">
          {title}
        </Title>
        <Text size="sm" c="gray.7" ta="center">
          {description}
        </Text>
        <Button
          component={Link}
          href="/writing/practice"
          leftSection={<IconPencil size={16} />}
          color="pink"
          variant="light"
        >
          Start Writing
        </Button>
      </Stack>
    </Card>
  );
}

type PaginationRowProps = {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
};

function PaginationRow({
  totalPages,
  currentPage,
  onPageChange,
}: PaginationRowProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <Group justify="center" mt="lg">
      <Pagination
        total={totalPages}
        value={currentPage}
        onChange={onPageChange}
      />
    </Group>
  );
}

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

  const deckOptions = useMemo(() => buildDeckOptions(decks), [decks]);

  const buildQueryParams = (page: number) => ({
    page,
    ...(query ? { q: query } : {}),
    ...(selectedDeckId ? { deckId: selectedDeckId } : {}),
  });

  const applyFilters = () => {
    router.push({
      pathname: "/writing",
      query: buildQueryParams(1),
    });
  };

  const goToPage = (page: number) => {
    router.push({
      pathname: "/writing",
      query: buildQueryParams(page),
    });
  };

  const toggleItem = (id: number) => {
    setExpandedItem((prev) => (prev === id ? null : id));
  };

  const handleDelete = (submissionId: number) => {
    if (!confirm("Are you sure you want to delete this submission?")) {
      return;
    }
    void router.push({
      pathname: "/writing/delete",
      query: {
        id: submissionId,
        page: currentPage,
      },
    });
  };

  const hasSubmissions = submissions.length > 0;
  const hasFilters = query.trim().length > 0 || selectedDeckId.length > 0;

  return (
    <Container size="md" py="md">
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        mb="md"
      >
        <Stack gap={2}>
          <Title order={2} c="pink.7">
            Writing History
          </Title>
          <Text size="sm" c="gray.7">
            Review feedback from your writing practice.
          </Text>
        </Stack>
        <Button
          component={Link}
          href="/writing/practice"
          leftSection={<IconPencil size={16} />}
          color="pink"
          variant="light"
        >
          New Writing Session
        </Button>
      </Group>

      <FiltersPanel
        query={query}
        selectedDeckId={selectedDeckId}
        deckOptions={deckOptions}
        onQueryChange={setQuery}
        onDeckChange={(val) => setSelectedDeckId(val ?? "")}
        onApply={applyFilters}
        totalPages={totalPages}
        currentPage={currentPage}
        onPageChange={goToPage}
      />

      {!hasSubmissions ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <Stack gap="md">
          {submissions.map((submission) => {
            const isExpanded = expandedItem === submission.id;
            return (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                isExpanded={isExpanded}
                onToggle={() => toggleItem(submission.id)}
                onDelete={() => handleDelete(submission.id)}
              />
            );
          })}
          <PaginationRow
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={goToPage}
          />
        </Stack>
      )}
    </Container>
  );
}
