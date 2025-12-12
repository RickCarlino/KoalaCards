import { backfillDecks } from "@/koala/decks/backfill-decks";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import { INITIAL_STATE, reducer } from "@/koala/types/create-reducer";
import type {
  LanguageInputPageProps,
  State,
} from "@/koala/types/create-types";
import { getLangName } from "@/koala/get-lang-name";
import {
  Button,
  Container,
  Divider,
  Grid,
  Group,
  Loader,
  Overlay,
  Paper,
  SegmentedControl,
  Select,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Radio,
  useMantineTheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import React from "react";

type Mode = "vibe" | "wordlist" | "csv";

type DeckSelection = State["deckSelection"];

type BulkCreateInput =
  | { deckId: number; input: State["processedCards"] }
  | {
      deckName: string;
      langCode: LangCode;
      input: State["processedCards"];
    };

function showError() {
  notifications.show({
    title: "Error",
    message: "Something went wrong. Please try again.",
    color: "red",
  });
}

function showValidationError(title: string, message: string) {
  notifications.show({ title, message, color: "red" });
}

function showSuccess(title: string, message: string) {
  notifications.show({ title, message, color: "green" });
}

function parseMode(value: unknown): Mode | undefined {
  if (value === "vibe" || value === "wordlist" || value === "csv") {
    return value;
  }
  return undefined;
}

function parseNumericId(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseWordsQuery(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }
  const decoded = decodeURIComponent(value);
  return decoded
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
}

function getDeckSelectionFromDecks(
  decks: LanguageInputPageProps["decks"],
) {
  return decks.length ? ("existing" as const) : ("new" as const);
}

function canSaveToDeck(
  state: Pick<
    State,
    "processedCards" | "deckSelection" | "deckId" | "deckName"
  >,
) {
  if (state.processedCards.length === 0) {
    return false;
  }
  if (state.deckSelection === "existing") {
    return Boolean(state.deckId);
  }
  return Boolean(state.deckName.trim());
}

function makeBulkCreateInput(
  state: Pick<
    State,
    "deckSelection" | "deckId" | "deckName" | "deckLang" | "processedCards"
  >,
): BulkCreateInput | undefined {
  if (state.processedCards.length === 0) {
    return undefined;
  }
  if (state.deckSelection === "existing") {
    if (!state.deckId) {
      return undefined;
    }
    return { deckId: state.deckId, input: state.processedCards };
  }
  const deckName = state.deckName.trim();
  if (!deckName) {
    return undefined;
  }
  return {
    deckName,
    langCode: state.deckLang,
    input: state.processedCards,
  };
}

export const getServerSideProps: GetServerSideProps<
  LanguageInputPageProps
> = async (context) => {
  const dbUser = await getServersideUser(context);
  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    } as const;
  }

  await backfillDecks(dbUser.id);
  const decks = await prismaClient.deck.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });

  if (decks.length === 0) {
    return {
      redirect: { destination: "/create-new", permanent: false },
    } as const;
  }

  return {
    props: {
      decks: decks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        langCode: "ko",
      })),
    },
  };
};

export default function CreateUnified(props: LanguageInputPageProps) {
  const { decks } = props;
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [separator, setSeparator] = React.useState(",");
  const [mode, setMode] = React.useState<Mode>("vibe");

  const [state, dispatch] = React.useReducer(reducer, {
    ...INITIAL_STATE,
    deckLang: decks[0]?.langCode ?? INITIAL_STATE.deckLang,
    deckSelection: getDeckSelectionFromDecks(decks),
    deckId: decks[0]?.id,
    deckName: decks[0]?.name || "",
  });

  const parseCards = trpc.parseCards.useMutation();
  const turbine = trpc.turbine.useMutation();
  const bulkCreate = trpc.bulkCreateCards.useMutation();

  React.useEffect(() => {
    const { isReady, query } = router;
    if (!isReady) {
      return;
    }
    const nextMode = parseMode(query.mode);
    if (nextMode) {
      setMode(nextMode);
    }

    const deckIdQuery = query.deckId ?? query.deck_id;
    const deckId = parseNumericId(deckIdQuery);
    const selectedDeck = deckId
      ? decks.find((deck) => deck.id === deckId)
      : undefined;
    if (selectedDeck) {
      dispatch({ type: "SET_DECK_SELECTION", deckSelection: "existing" });
      dispatch({ type: "SET_DECK_ID", deckId: selectedDeck.id });
      dispatch({ type: "SET_DECK_LANG", deckLang: selectedDeck.langCode });
      dispatch({ type: "SET_DECK_NAME", deckName: selectedDeck.name });
    }

    const words = parseWordsQuery(query.words);
    if (words.length) {
      dispatch({ type: "SET_RAW_INPUT", rawInput: words.join("\n") });
    }
  }, [router, decks]);

  const lines = React.useMemo(() => {
    return state.rawInput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 1500);
  }, [state.rawInput]);
  const parsedRows = React.useMemo(
    () => lines.map((line) => parseCsvLine(line, separator)),
    [lines, separator],
  );

  const handleSubmitVibe = async () => {
    if (!state.rawInput.trim()) {
      showValidationError("No input", "What cards shall we create?");
      return;
    }
    setLoading(true);
    try {
      const { cards } = await parseCards.mutateAsync({
        langCode: state.deckLang,
        text: state.rawInput,
      });
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: cards });
      showSuccess("Generated", `Created ${cards.length} cards`);
    } catch {
      showError();
    } finally {
      setLoading(false);
    }
  };

  const handleProcessWordlist = async () => {
    const words = state.rawInput.trim();
    if (!words) {
      showValidationError("No words", "Add at least one word.");
      return;
    }
    setLoading(true);
    try {
      const result = await turbine.mutateAsync({
        words,
        langCode: state.deckLang,
      });
      const processed = result.map((r) => ({
        ...r,
        gender: "N" as const,
      }));
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: processed });
      showSuccess("Processed", `Found ${processed.length} definitions`);
    } catch {
      showError();
    } finally {
      setLoading(false);
    }
  };

  const handleProcessCsv = () => {
    const processed = parsedRows
      .filter((r) => r.term && r.definition)
      .map((r) => ({ ...r, gender: "N" as const }));
    if (!processed.length) {
      showValidationError("No valid rows", "Provide term and definition.");
      return;
    }
    dispatch({ type: "SET_PROCESSED_CARDS", processedCards: processed });
    showSuccess("Parsed", `Parsed ${processed.length} rows`);
  };

  const saveCards = async () => {
    const payload = makeBulkCreateInput(state);
    if (!payload) {
      return;
    }
    setLoading(true);
    try {
      await bulkCreate.mutateAsync(payload);
      showSuccess(
        "Saved",
        `Added ${state.processedCards.length} cards to your deck`,
      );
      router.push("/review");
    } catch {
      showError();
    } finally {
      setLoading(false);
    }
  };

  const deckOptions = React.useMemo(() => makeDeckOptions(decks), [decks]);

  const onExistingDeckChange = (val: string | null) => {
    const id = val ? Number(val) : undefined;
    dispatch({ type: "SET_DECK_ID", deckId: id });
    const selected = decks.find((d) => d.id === id);
    if (selected) {
      dispatch({
        type: "SET_DECK_LANG",
        deckLang: selected.langCode,
      });
      dispatch({ type: "SET_DECK_NAME", deckName: selected.name });
    }
  };

  const canSave = canSaveToDeck(state);

  return (
    <Container size="lg" py="lg" style={{ position: "relative" }}>
      {loading && (
        <Overlay blur={2} opacity={0.6} color="#fff" zIndex={9999}>
          <Loader size="lg" variant="dots" />
        </Overlay>
      )}

      <Title order={1} mb="sm">
        Create Cards
      </Title>
      <Text c="dimmed" mb="lg">
        Choose a deck, add content, preview live, then save.
      </Text>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <DeckSection
            deckOptions={deckOptions}
            deckSelection={state.deckSelection}
            deckId={state.deckId}
            deckName={state.deckName}
            onSelectExistingDeck={onExistingDeckChange}
            onSetSelection={(sel) =>
              dispatch({ type: "SET_DECK_SELECTION", deckSelection: sel })
            }
            onSetDeckName={(name) =>
              dispatch({ type: "SET_DECK_NAME", deckName: name })
            }
          />

          <ContentSection
            mode={mode}
            onModeChange={(m) => setMode(m)}
            rawInput={state.rawInput}
            setRawInput={(v) =>
              dispatch({ type: "SET_RAW_INPUT", rawInput: v })
            }
            separator={separator}
            setSeparator={setSeparator}
            linesCount={lines.length}
            parsedRows={parsedRows}
            deckLangName={getLangName(state.deckLang)}
            onVibe={handleSubmitVibe}
            onWordlist={handleProcessWordlist}
            onCsv={handleProcessCsv}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <PreviewSection
            processedCards={state.processedCards}
            onEdit={(index, field, value) =>
              dispatch({
                type: "EDIT_CARD",
                card: { ...state.processedCards[index], [field]: value },
                index,
              })
            }
            onRemove={(index) => dispatch({ type: "REMOVE_CARD", index })}
            canSave={canSave}
            onSave={saveCards}
          />
        </Grid.Col>
      </Grid>
    </Container>
  );
}

function parseCsvLine(line: string, separator: string) {
  const parts = line.split(separator);
  const term = parts[0]?.trim() ?? "";
  const definition = parts.slice(1).join(separator).trim();
  return { term, definition };
}

function makeDeckOptions(decks: LanguageInputPageProps["decks"]) {
  return decks.map((d) => ({
    value: String(d.id),
    label: `${d.name} (${getLangName(d.langCode)})`,
  }));
}

type DeckOption = { value: string; label: string };

type DeckSectionProps = {
  deckOptions: DeckOption[];
  deckSelection: DeckSelection;
  deckId?: number;
  deckName: string;
  onSelectExistingDeck: (val: string | null) => void;
  onSetSelection: (sel: "existing" | "new") => void;
  onSetDeckName: (name: string) => void;
};

function DeckSection(props: DeckSectionProps) {
  const {
    deckOptions,
    deckSelection,
    deckId,
    deckName,
    onSelectExistingDeck,
    onSetSelection,
    onSetDeckName,
  } = props;

  const contentBySelection: Record<DeckSelection, React.ReactNode> = {
    existing: (
      <ExistingDeckFields
        deckOptions={deckOptions}
        deckId={deckId}
        onSelectExistingDeck={onSelectExistingDeck}
      />
    ),
    new: (
      <NewDeckFields deckName={deckName} onSetDeckName={onSetDeckName} />
    ),
  };

  return (
    <Paper withBorder p="md" radius="md" mb="md">
      <Group justify="space-between" mb="xs">
        <Title order={4}>Deck</Title>
        <Radio.Group
          value={deckSelection}
          onChange={(v) => onSetSelection(v as "existing" | "new")}
        >
          <Group gap="sm">
            <Radio value="existing" label="Existing" />
            <Radio value="new" label="New" />
          </Group>
        </Radio.Group>
      </Group>
      {contentBySelection[deckSelection]}
    </Paper>
  );
}

type ExistingDeckFieldsProps = {
  deckOptions: DeckOption[];
  deckId?: number;
  onSelectExistingDeck: (val: string | null) => void;
};

function ExistingDeckFields(props: ExistingDeckFieldsProps) {
  const { deckOptions, deckId, onSelectExistingDeck } = props;
  return (
    <Select
      data={deckOptions}
      value={deckId ? String(deckId) : null}
      onChange={onSelectExistingDeck}
      placeholder="Pick a deck"
      label="Existing deck"
    />
  );
}

type NewDeckFieldsProps = {
  deckName: string;
  onSetDeckName: (name: string) => void;
};

function NewDeckFields(props: NewDeckFieldsProps) {
  const { deckName, onSetDeckName } = props;
  return (
    <TextInput
      label="Deck name"
      placeholder="My Travel Phrases"
      value={deckName}
      onChange={(e) => onSetDeckName(e.currentTarget.value)}
      mb="sm"
    />
  );
}

type ContentSectionProps = {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  rawInput: string;
  setRawInput: (text: string) => void;
  separator: string;
  setSeparator: (sep: string) => void;
  linesCount: number;
  parsedRows: { term: string; definition: string }[];
  deckLangName: string;
  onVibe: () => void;
  onWordlist: () => void;
  onCsv: () => void;
};

function ContentSection(props: ContentSectionProps) {
  const {
    mode,
    onModeChange,
    rawInput,
    setRawInput,
    separator,
    setSeparator,
    linesCount,
    parsedRows,
    deckLangName,
    onVibe,
    onWordlist,
    onCsv,
  } = props;
  const theme = useMantineTheme();

  const body = getContentBody({
    mode,
    theme,
    deckLangName,
    rawInput,
    setRawInput,
    separator,
    setSeparator,
    linesCount,
    parsedRows,
    onVibe,
    onWordlist,
    onCsv,
  });

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Title order={4}>Content</Title>
        <SegmentedControl
          value={mode}
          onChange={(val) => onModeChange(val as Mode)}
          data={[
            { label: "Free Form", value: "vibe" },
            { label: "Word list", value: "wordlist" },
            { label: "CSV/Text", value: "csv" },
          ]}
        />
      </Group>
      {body}
    </Paper>
  );
}

type ContentBodyParams = {
  mode: Mode;
  theme: ReturnType<typeof useMantineTheme>;
  deckLangName: string;
  rawInput: string;
  setRawInput: (text: string) => void;
  separator: string;
  setSeparator: (sep: string) => void;
  linesCount: number;
  parsedRows: { term: string; definition: string }[];
  onVibe: () => void;
  onWordlist: () => void;
  onCsv: () => void;
};

function getContentBody(params: ContentBodyParams) {
  const {
    mode,
    theme,
    deckLangName,
    rawInput,
    setRawInput,
    separator,
    setSeparator,
    linesCount,
    parsedRows,
    onVibe,
    onWordlist,
    onCsv,
  } = params;

  switch (mode) {
    case "vibe":
      return (
        <VibeContent
          themeColors={theme.colors}
          deckLangName={deckLangName}
          rawInput={rawInput}
          setRawInput={setRawInput}
          onGenerate={onVibe}
        />
      );
    case "wordlist":
      return (
        <WordlistContent
          themeColors={theme.colors}
          rawInput={rawInput}
          setRawInput={setRawInput}
          onEnrich={onWordlist}
        />
      );
    case "csv":
      return (
        <CsvContent
          themeColors={theme.colors}
          separator={separator}
          setSeparator={setSeparator}
          rawInput={rawInput}
          setRawInput={setRawInput}
          linesCount={linesCount}
          parsedRows={parsedRows}
          onParse={onCsv}
        />
      );
    default:
      return null;
  }
}

function VibeContent(props: {
  themeColors: ReturnType<typeof useMantineTheme>["colors"];
  deckLangName: string;
  rawInput: string;
  setRawInput: (text: string) => void;
  onGenerate: () => void;
}) {
  const { themeColors, deckLangName, rawInput, setRawInput, onGenerate } =
    props;
  return (
    <>
      <Text size="sm" c={themeColors.gray[7]} mb="xs">
        What cards shall we create? Example:{" "}
        {`"Please make 25 ${deckLangName} example sentences about food."`}
      </Text>
      <Textarea
        minRows={6}
        autosize
        placeholder={`Please make 25 ${deckLangName} example sentences about travel.`}
        value={rawInput}
        onChange={(e) => setRawInput(e.currentTarget.value)}
      />
      <Group justify="flex-end" mt="md">
        <Button onClick={onGenerate}>Generate</Button>
      </Group>
    </>
  );
}

function WordlistContent(props: {
  themeColors: ReturnType<typeof useMantineTheme>["colors"];
  rawInput: string;
  setRawInput: (text: string) => void;
  onEnrich: () => void;
}) {
  const { themeColors, rawInput, setRawInput, onEnrich } = props;
  return (
    <>
      <Text size="sm" c={themeColors.gray[7]} mb="xs">
        Paste one word per line. We’ll fetch definitions.
      </Text>
      <Textarea
        minRows={6}
        autosize
        placeholder={`hola\nadiós\npor favor`}
        value={rawInput}
        onChange={(e) => setRawInput(e.currentTarget.value)}
      />
      <Group justify="flex-end" mt="md">
        <Button onClick={onEnrich}>Enrich</Button>
      </Group>
    </>
  );
}

function CsvContent(props: {
  themeColors: ReturnType<typeof useMantineTheme>["colors"];
  separator: string;
  setSeparator: (sep: string) => void;
  rawInput: string;
  setRawInput: (text: string) => void;
  linesCount: number;
  parsedRows: { term: string; definition: string }[];
  onParse: () => void;
}) {
  const {
    themeColors,
    separator,
    setSeparator,
    rawInput,
    setRawInput,
    linesCount,
    parsedRows,
    onParse,
  } = props;
  return (
    <>
      <Text size="sm" c={themeColors.gray[7]} mb="xs">
        Each line: term{separator}definition. First value is term, the rest
        is definition.
      </Text>
      <Group align="flex-end" gap="md" mb="sm">
        <TextInput
          label="Separator"
          placeholder=","
          value={separator}
          onChange={(e) => setSeparator(e.currentTarget.value)}
          style={{ maxWidth: 200 }}
        />
        <Button onClick={onParse}>Parse</Button>
      </Group>
      <Textarea
        minRows={6}
        autosize
        placeholder={`hola, hello\nadiós, goodbye`}
        value={rawInput}
        onChange={(e) => setRawInput(e.currentTarget.value)}
      />
      <Divider my="sm" />
      <Text size="sm">{linesCount} lines detected • showing first 10</Text>
      <CsvPreview rows={parsedRows.slice(0, 10)} />
    </>
  );
}

function CsvPreview(props: {
  rows: { term: string; definition: string }[];
}) {
  const { rows } = props;
  return (
    <Table withColumnBorders striped mt="xs">
      <thead>
        <tr>
          <th>Term</th>
          <th>Definition</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td>
              {row.term || <em style={{ color: "gray" }}>No term</em>}
            </td>
            <td>
              {row.definition || (
                <em style={{ color: "gray" }}>No definition</em>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

type PreviewSectionProps = {
  processedCards: State["processedCards"];
  onEdit: (
    index: number,
    field: "term" | "definition",
    value: string,
  ) => void;
  onRemove: (index: number) => void;
  canSave: boolean;
  onSave: () => void;
};

function PreviewSection(props: PreviewSectionProps) {
  const { processedCards, onEdit, onRemove, canSave, onSave } = props;
  if (processedCards.length === 0) {
    return (
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="xs">
          <Title order={4}>Preview</Title>
          <Button onClick={onSave} disabled={!canSave}>
            Save
          </Button>
        </Group>
        <Text c="dimmed">No cards yet. Generate or parse to preview.</Text>
      </Paper>
    );
  }
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Title order={4}>Preview</Title>
        <Button onClick={onSave} disabled={!canSave}>
          Save {processedCards.length ? `(${processedCards.length})` : ""}
        </Button>
      </Group>
      {processedCards.map((card, index) => (
        <Group key={`${card.term}-${index}`} grow align="flex-end" mb="sm">
          <TextInput
            label="Term"
            value={card.term}
            onChange={(e) => onEdit(index, "term", e.currentTarget.value)}
          />
          <TextInput
            label="Definition"
            value={card.definition}
            onChange={(e) =>
              onEdit(index, "definition", e.currentTarget.value)
            }
          />
          <Button
            color="red"
            variant="light"
            onClick={() => onRemove(index)}
          >
            Remove
          </Button>
        </Group>
      ))}
    </Paper>
  );
}
