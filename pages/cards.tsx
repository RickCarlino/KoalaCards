import { GetServerSideProps } from "next";
import { CardTable } from "@/koala/card-table";
import { SectionCard } from "@/koala/components/SectionCard";
import { trpc } from "@/koala/trpc-config";
import {
  Badge,
  Button,
  Container,
  Grid,
  Group,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Checkbox,
  Title,
} from "@mantine/core";
import { prismaClient } from "@/koala/prisma-client";
import { useRouter } from "next/router";
import { useState, useEffect, FormEvent } from "react";
import { getServersideUser } from "@/koala/get-serverside-user";
import Link from "next/link";

type CardRecord = {
  id: number;
  flagged: boolean;
  term: string;
  definition: string;
  createdAt: string;
  gender: string;
  repetitions: number;
  lapses: number;
  lastReview: number;
  nextReview: number;
};

type DeckListItem = {
  id: number;
  name: string;
};

type EditProps = {
  cards: CardRecord[];
  totalCount: number;
  sortBy: string;
  sortOrder: string;
  page: number;
  totalPages: number;
  q: string;
  paused: boolean;
  deckId: number | null;
  decks: DeckListItem[];
};

const SORT_OPTIONS = [
  { label: "Date Created", value: "createdAt" },
  { label: "Date Failed", value: "lastFailure" },
  { label: "Definition", value: "definition" },
  { label: "Paused", value: "flagged" },
  { label: "Term", value: "term" },
  { label: "Next Review", value: "nextReview" },
  { label: "Repetitions", value: "repetitions" },
  { label: "Lapses", value: "lapses" },
];

const ORDER_OPTIONS = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

const ITEMS_PER_PAGE = 200;
const DEFAULT_SORT_BY = "createdAt";
const DEFAULT_SORT_ORDER = "desc";
const DEFAULT_PAGE = 1;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  const userId = dbUser?.id;

  if (!userId) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const parsedQuery = parseQueryParams(ctx.query);
  const decks = await prismaClient.deck.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const selectedDeckId = getValidDeckId(parsedQuery.deckId, decks);
  const { cards, totalPages, totalCount, page } = await fetchCards(
    userId,
    parsedQuery.sortBy,
    parsedQuery.sortOrder,
    parsedQuery.page,
    parsedQuery.q,
    parsedQuery.paused,
    selectedDeckId,
  );

  return {
    props: {
      cards,
      totalCount,
      sortBy: parsedQuery.sortBy,
      sortOrder: parsedQuery.sortOrder,
      page,
      totalPages,
      q: parsedQuery.q,
      paused: parsedQuery.paused,
      deckId: selectedDeckId,
      decks,
    },
  };
};

function parseQueryParams(query: Record<string, unknown>) {
  const toStr = (val: unknown): string | undefined => {
    if (typeof val === "string") {
      return val;
    }
    if (Array.isArray(val)) {
      return val[0];
    }
    return undefined;
  };

  const rawSortBy = toStr(query.sortBy) ?? DEFAULT_SORT_BY;
  const rawSortOrder = toStr(query.sortOrder) ?? DEFAULT_SORT_ORDER;
  const rawPage = parseInt(toStr(query.page) ?? "", 10);
  const rawQ = toStr(query.q) ?? "";
  const rawPaused = toStr(query.paused) ?? "false";
  const rawDeckId = parseInt(
    toStr(query.deckId) ?? toStr(query.deck_id) ?? "",
    10,
  );

  const validSortBy = SORT_OPTIONS.map((o) => o.value).includes(rawSortBy)
    ? rawSortBy
    : DEFAULT_SORT_BY;
  const finalSortOrder =
    rawSortOrder === "asc" ? "asc" : DEFAULT_SORT_ORDER;
  const finalPage =
    !Number.isNaN(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const finalPaused = rawPaused === "true";
  const deckId =
    Number.isFinite(rawDeckId) && rawDeckId > 0 ? rawDeckId : null;

  return {
    sortBy: validSortBy,
    sortOrder: finalSortOrder,
    page: finalPage,
    q: rawQ,
    paused: finalPaused,
    deckId,
  };
}

function getValidDeckId(deckId: number | null, decks: DeckListItem[]) {
  if (deckId === null) {
    return null;
  }

  return decks.some((deck) => deck.id === deckId) ? deckId : null;
}

async function fetchCards(
  userId: string,
  sortBy: string,
  sortOrder: string,
  page: number,
  q: string,
  paused: boolean,
  deckId: number | null,
) {
  const where = {
    userId,
    ...(paused ? { flagged: true } : {}),
    ...(deckId !== null ? { deckId } : {}),
    ...(q
      ? {
          OR: [
            { term: { contains: q, mode: "insensitive" as const } },
            { definition: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const totalCount = await prismaClient.card.count({ where });
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
  const finalPage = Math.min(Math.max(page, 1), totalPages);

  const cardsData = await prismaClient.card.findMany({
    where,
    orderBy: [{ [sortBy]: sortOrder }],
    skip: (finalPage - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
  });

  const cards = cardsData.map((c) => ({
    id: c.id,
    flagged: c.flagged,
    term: c.term,
    definition: c.definition,
    createdAt: c.createdAt.toISOString(),
    gender: c.gender,
    repetitions: c.repetitions ?? 0,
    lapses: c.lapses ?? 0,
    lastReview: c.lastReview ?? 0,
    nextReview: c.nextReview ?? 0,
  }));

  return { cards, totalPages, totalCount, page: finalPage };
}

type FilterState = {
  query: string;
  showPaused: boolean;
  selectedDeckId: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type CardsHeaderProps = {
  totalCount: number;
};

type FiltersPanelProps = {
  query: string;
  sortBy: string;
  sortOrder: string;
  showPaused: boolean;
  selectedDeckId: string;
  deckOptions: SelectOption[];
  onQueryChange: (value: string) => void;
  onSortByChange: (value: string) => void;
  onSortOrderChange: (value: string) => void;
  onShowPausedChange: (value: boolean) => void;
  onDeckChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
};

type MaintenancePanelProps = {
  onDeletePaused: () => void;
  isDeleting: boolean;
};

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

type ResultsSummaryProps = {
  totalCount: number;
  page: number;
  totalPages: number;
};

type EmptyStateProps = {
  hasFilters: boolean;
  onResetFilters: () => void;
};

type ActiveFilter = {
  key: string;
  label: string;
  value: string;
};

type CardsTablePanelProps = {
  cards: CardRecord[];
  totalCount: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onResetFilters: () => void;
  activeFilters: ActiveFilter[];
};

function buildDeckOptions(decks: DeckListItem[]): SelectOption[] {
  return [
    { value: "", label: "All decks" },
    ...decks.map((deck) => ({
      value: String(deck.id),
      label: deck.name,
    })),
  ];
}

function formatCountLabel(count: number, noun: string) {
  const suffix = count === 1 ? noun : `${noun}s`;
  return `${count} ${suffix}`;
}

function getResultRange(
  totalCount: number,
  page: number,
  itemsPerPage: number,
) {
  if (totalCount <= 0) {
    return { start: 0, end: 0 };
  }
  const start = (page - 1) * itemsPerPage + 1;
  const end = Math.min(page * itemsPerPage, totalCount);
  return { start, end };
}

function buildActiveFilters(
  filters: FilterState,
  decks: DeckListItem[],
): ActiveFilter[] {
  const items: ActiveFilter[] = [];
  const trimmedQuery = filters.query.trim();
  if (trimmedQuery) {
    items.push({
      key: "query",
      label: "Search",
      value: trimmedQuery,
    });
  }
  if (filters.showPaused) {
    items.push({
      key: "paused",
      label: "Paused",
      value: "Only paused",
    });
  }
  if (filters.selectedDeckId) {
    const deck = decks.find(
      (item) => String(item.id) === filters.selectedDeckId,
    );
    if (deck) {
      items.push({
        key: "deck",
        label: "Deck",
        value: deck.name,
      });
    }
  }
  return items;
}

type ActiveFiltersProps = {
  filters: ActiveFilter[];
  onClear: () => void;
};

function ActiveFilters({ filters, onClear }: ActiveFiltersProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <Group gap="xs" wrap="wrap">
      {filters.map((filter) => (
        <Badge key={filter.key} variant="light" color="pink">
          {filter.label}: {filter.value}
        </Badge>
      ))}
      <Button variant="subtle" size="xs" onClick={onClear}>
        Clear filters
      </Button>
    </Group>
  );
}

function CardsHeader({ totalCount }: CardsHeaderProps) {
  return (
    <Stack gap="xs">
      <Group justify="space-between" align="baseline" wrap="wrap">
        <Title order={2}>Your Cards</Title>
        <Badge color="pink" variant="light">
          {formatCountLabel(totalCount, "card")}
        </Badge>
      </Group>
      <Text c="dimmed">
        Browse, search, and manage your cards. Quick-edit or open details.
      </Text>
    </Stack>
  );
}

function FiltersPanel({
  query,
  sortBy,
  sortOrder,
  showPaused,
  selectedDeckId,
  deckOptions,
  onQueryChange,
  onSortByChange,
  onSortOrderChange,
  onShowPausedChange,
  onDeckChange,
  onSubmit,
  onReset,
}: FiltersPanelProps) {
  return (
    <SectionCard
      title="Filters"
      description="Search across cards and refine the list."
    >
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Search"
                placeholder="Find by term or definition"
                value={query}
                onChange={(event) =>
                  onQueryChange(event.currentTarget.value)
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Deck"
                value={selectedDeckId}
                onChange={(value) => onDeckChange(value ?? "")}
                data={deckOptions}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Select
                label="Sort by"
                value={sortBy}
                onChange={(value) =>
                  value ? onSortByChange(value) : undefined
                }
                data={SORT_OPTIONS}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Select
                label="Order"
                value={sortOrder}
                onChange={(value) =>
                  value ? onSortOrderChange(value) : undefined
                }
                data={ORDER_OPTIONS}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Checkbox
                label="Show paused only"
                checked={showPaused}
                onChange={(event) =>
                  onShowPausedChange(event.currentTarget.checked)
                }
                mt="md"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12 }}>
              <Group gap="sm" justify="flex-end">
                <Button type="submit">Apply</Button>
                <Button variant="light" type="button" onClick={onReset}>
                  Reset
                </Button>
              </Group>
            </Grid.Col>
          </Grid>
        </Stack>
      </form>
    </SectionCard>
  );
}

function MaintenancePanel({
  onDeletePaused,
  isDeleting,
}: MaintenancePanelProps) {
  return (
    <SectionCard
      title="Paused cards"
      description="Remove cards you have paused across all decks."
      action={
        <Button
          variant="outline"
          color="red"
          onClick={onDeletePaused}
          loading={isDeleting}
        >
          Delete Paused Cards
        </Button>
      }
    >
      <Group justify="space-between" align="center" wrap="wrap">
        <Text size="sm" c="dimmed">
          This permanently deletes paused cards. Use with care.
        </Text>
      </Group>
    </SectionCard>
  );
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <Group gap="xs">
      <Button
        variant="light"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <Button
        variant="light"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </Group>
  );
}

function ResultsSummary({
  totalCount,
  page,
  totalPages,
}: ResultsSummaryProps) {
  const { start, end } = getResultRange(totalCount, page, ITEMS_PER_PAGE);
  const pageText =
    totalPages > 1 ? ` · Page ${page} of ${totalPages}` : "";

  return (
    <Text size="sm" c="dimmed">
      Showing {start}-{end} of {totalCount} cards
      {pageText}
    </Text>
  );
}

function EmptyState({ hasFilters, onResetFilters }: EmptyStateProps) {
  let title = "No cards yet";
  let description =
    "Build your first deck to start studying with Koala Cards.";
  let action = (
    <Button component={Link} href="/create">
      Add cards
    </Button>
  );

  if (hasFilters) {
    title = "No matches found";
    description = "Try clearing filters or adjusting your search.";
    action = (
      <Button variant="light" onClick={onResetFilters}>
        Reset filters
      </Button>
    );
  }

  return (
    <SectionCard title={title} description={description}>
      <Group>{action}</Group>
    </SectionCard>
  );
}

function CardsTablePanel({
  cards,
  totalCount,
  page,
  totalPages,
  onPageChange,
  onResetFilters,
  activeFilters,
}: CardsTablePanelProps) {
  const showFilters = activeFilters.length > 0;
  const pagination = (
    <PaginationControls
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );

  if (cards.length === 0) {
    return (
      <EmptyState
        hasFilters={showFilters}
        onResetFilters={onResetFilters}
      />
    );
  }

  return (
    <SectionCard title="Results" action={pagination}>
      <Stack gap="md">
        <ResultsSummary
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
        />
        <ActiveFilters filters={activeFilters} onClear={onResetFilters} />
        <ScrollArea type="auto">
          <CardTable onDelete={() => undefined} cards={cards} />
        </ScrollArea>
        <Group justify="flex-end">{pagination}</Group>
      </Stack>
    </SectionCard>
  );
}

export default function Edit({
  cards,
  totalCount,
  sortBy,
  sortOrder,
  page,
  totalPages,
  q,
  paused,
  deckId,
  decks,
}: EditProps) {
  const deleteFlagged = trpc.deletePausedCards.useMutation();
  const router = useRouter();

  const [currentSortBy, setCurrentSortBy] = useState(sortBy);
  const [currentSortOrder, setCurrentSortOrder] = useState(sortOrder);
  const [query, setQuery] = useState(q);
  const [showPaused, setShowPaused] = useState(paused);
  const [selectedDeckId, setSelectedDeckId] = useState(
    deckId ? String(deckId) : "",
  );

  useEffect(() => {
    setCurrentSortBy(sortBy);
    setCurrentSortOrder(sortOrder);
    setQuery(q);
    setShowPaused(paused);
    setSelectedDeckId(deckId ? String(deckId) : "");
  }, [deckId, paused, q, sortBy, sortOrder]);

  const appliedFilters: FilterState = {
    query: q,
    showPaused: paused,
    selectedDeckId: deckId ? String(deckId) : "",
  };
  const activeFilters = buildActiveFilters(appliedFilters, decks);

  const handleDeletePaused = async () => {
    if (confirm("Are you sure you want to delete all paused cards?")) {
      await deleteFlagged.mutateAsync({});
      location.reload();
    }
  };

  const buildQuery = (pageNumber: number) => ({
    sortBy: currentSortBy,
    sortOrder: currentSortOrder,
    page: String(pageNumber),
    q: query,
    paused: String(showPaused),
    ...(selectedDeckId ? { deckId: selectedDeckId } : {}),
  });

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push({
      pathname: "/cards",
      query: buildQuery(DEFAULT_PAGE),
    });
  };

  const handleResetFilters = () => {
    setCurrentSortBy(DEFAULT_SORT_BY);
    setCurrentSortOrder(DEFAULT_SORT_ORDER);
    setQuery("");
    setShowPaused(false);
    setSelectedDeckId("");
    router.push({
      pathname: "/cards",
      query: {
        sortBy: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER,
        page: String(DEFAULT_PAGE),
      },
    });
  };

  const goToPage = (newPage: number) => {
    router.push({
      pathname: "/cards",
      query: buildQuery(newPage),
    });
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <CardsHeader totalCount={totalCount} />

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="lg">
              <FiltersPanel
                query={query}
                sortBy={currentSortBy}
                sortOrder={currentSortOrder}
                showPaused={showPaused}
                selectedDeckId={selectedDeckId}
                deckOptions={buildDeckOptions(decks)}
                onQueryChange={setQuery}
                onSortByChange={setCurrentSortBy}
                onSortOrderChange={setCurrentSortOrder}
                onShowPausedChange={setShowPaused}
                onDeckChange={setSelectedDeckId}
                onSubmit={handleSearch}
                onReset={handleResetFilters}
              />

              <MaintenancePanel
                onDeletePaused={handleDeletePaused}
                isDeleting={deleteFlagged.isLoading}
              />
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <CardsTablePanel
              cards={cards}
              totalCount={totalCount}
              page={page}
              totalPages={totalPages}
              onPageChange={goToPage}
              onResetFilters={handleResetFilters}
              activeFilters={activeFilters}
            />
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
