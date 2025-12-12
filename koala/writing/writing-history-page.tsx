import { CenteredPager, Pager } from "@/koala/components/Pager";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";
import { formatIsoDate } from "@/koala/utils/formatters";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Container,
  Divider,
  Group,
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
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type {
  WritingHistoryProps,
  WritingSubmissionView,
} from "@/koala/writing/writing-history-types";

type FilterState = {
  query: string;
  deckId: string;
};

function deckIdToSelectValue(deckId: number | null) {
  return deckId === null ? "" : String(deckId);
}

function buildQueryParams(params: {
  page: number;
  query: string;
  deckId: string;
}) {
  const next: Record<string, string | number> = { page: params.page };
  if (params.query) {
    next.q = params.query;
  }
  if (params.deckId) {
    next.deckId = params.deckId;
  }
  return next;
}

function WritingFilters(props: {
  totalPages: number;
  currentPage: number;
  decks: WritingHistoryProps["decks"];
  filterState: FilterState;
  onFilterStateChange: (next: FilterState) => void;
  onApply: () => void;
  onPage: (page: number) => void;
}) {
  const deckOptions = useMemo(
    () =>
      [{ value: "", label: "All decks" }].concat(
        props.decks.map((deck) => ({
          value: String(deck.id),
          label: `${deck.name} (${deck.langCode})`,
        })),
      ),
    [props.decks],
  );

  return (
    <Paper withBorder p="md" radius="md" mt="sm" mb="md">
      <Group align="flex-end" wrap="wrap">
        <TextInput
          label="Search"
          placeholder="Prompt, submission, or correction"
          value={props.filterState.query}
          onChange={(e) =>
            props.onFilterStateChange({
              ...props.filterState,
              query: e.currentTarget.value,
            })
          }
          style={{ minWidth: 260 }}
        />
        <Select
          label="Deck"
          value={props.filterState.deckId}
          onChange={(value) =>
            props.onFilterStateChange({
              ...props.filterState,
              deckId: value ?? "",
            })
          }
          data={deckOptions}
          style={{ minWidth: 220 }}
        />
        <Button
          leftSection={<IconFilter size={16} />}
          variant="light"
          onClick={props.onApply}
        >
          Apply
        </Button>
        <Group ml="auto">
          <Pager
            totalPages={props.totalPages}
            page={props.currentPage}
            onPage={props.onPage}
          />
        </Group>
      </Group>
    </Paper>
  );
}

function EmptyWritingHistory() {
  return (
    <Alert title="No submissions found" color="blue">
      You haven't submitted any writing practice yet.{" "}
      <Link href="/create">Add a deck</Link> and{" "}
      <Link href="/review">do some writing exercises!</Link>
    </Alert>
  );
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        {props.title}
      </Text>
      {props.children}
    </Stack>
  );
}

function DetailsToggle(props: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = props.expanded ? "Hide Details" : "Show Details";

  return (
    <UnstyledButton
      onClick={props.onToggle}
      styles={(theme) => ({
        root: {
          display: "block",
          width: "100%",
          textAlign: "center",
          padding: theme.spacing.xs,
          borderRadius: theme.radius.sm,
          color: theme.colors.blue[6],
          "&:hover": { backgroundColor: theme.colors.gray[0] },
        },
      })}
    >
      {label}
    </UnstyledButton>
  );
}

function SubmissionDetails(props: { submission: WritingSubmissionView }) {
  return (
    <Stack gap="md" mt="xs">
      <Divider />
      <Section title="Your Submission:">
        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
          {props.submission.submission}
        </Text>
      </Section>
      <Section title="Corrected Text:">
        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
          {props.submission.correction}
        </Text>
      </Section>
      <Section title="Changes:">
        <VisualDiff
          actual={props.submission.submission}
          expected={props.submission.correction}
        />
      </Section>
    </Stack>
  );
}

function SubmissionCard(props: {
  submission: WritingSubmissionView;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={5}>
            <Text fw={700} size="lg">
              {formatIsoDate(props.submission.createdAt)}
            </Text>
            <Group gap="xs">
              <Badge color="pink" variant="light">
                {props.submission.deck.name}
              </Badge>
              <Badge variant="outline">
                {props.submission.deck.langCode.toUpperCase()}
              </Badge>
            </Group>
          </Stack>
          <Tooltip label="Delete submission">
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={props.onDelete}
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Section title="Prompt:">
          <Text size="sm" mb="xs">
            {props.submission.prompt}
          </Text>
        </Section>

        <DetailsToggle
          expanded={props.expanded}
          onToggle={props.onToggle}
        />
        {props.expanded && (
          <SubmissionDetails submission={props.submission} />
        )}
      </Stack>
    </Paper>
  );
}

function WritingBody(props: {
  submissions: WritingHistoryProps["submissions"];
  expandedItem: number | null;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  if (props.submissions.length === 0) {
    return <EmptyWritingHistory />;
  }

  return (
    <Stack gap="xl">
      {props.submissions.map((submission) => (
        <SubmissionCard
          key={submission.id}
          submission={submission}
          expanded={props.expandedItem === submission.id}
          onToggle={() => props.onToggle(submission.id)}
          onDelete={() => props.onDelete(submission.id)}
        />
      ))}
    </Stack>
  );
}

export function WritingHistoryPage(props: WritingHistoryProps) {
  const router = useRouter();
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [filterState, setFilterState] = useState<FilterState>(() => ({
    query: props.q,
    deckId: deckIdToSelectValue(props.deckId),
  }));

  const toggleItem = (id: number) => {
    setExpandedItem((prev) => (prev === id ? null : id));
  };

  const pushWithFilters = (page: number) =>
    router.push({
      pathname: "/writing",
      query: buildQueryParams({
        page,
        query: filterState.query,
        deckId: filterState.deckId,
      }),
    });

  const goToPage = (page: number) => void pushWithFilters(page);
  const applyFilters = () => void pushWithFilters(1);

  const confirmDelete = (id: number) => {
    const ok = confirm("Are you sure you want to delete this submission?");
    if (!ok) {
      return;
    }
    void router.push({
      pathname: "/writing/delete",
      query: { id, page: props.currentPage },
    });
  };

  return (
    <Container size="md" py="md">
      <Title order={2}>My Writing History</Title>

      <WritingFilters
        totalPages={props.totalPages}
        currentPage={props.currentPage}
        decks={props.decks}
        filterState={filterState}
        onFilterStateChange={setFilterState}
        onApply={applyFilters}
        onPage={goToPage}
      />

      <WritingBody
        submissions={props.submissions}
        expandedItem={expandedItem}
        onToggle={toggleItem}
        onDelete={confirmDelete}
      />

      <CenteredPager
        totalPages={props.totalPages}
        page={props.currentPage}
        onPage={goToPage}
      />
    </Container>
  );
}
