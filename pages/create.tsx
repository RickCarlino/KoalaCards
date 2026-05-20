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
import { containsHangul } from "@/koala/utils/hangul";
import {
  ActionIcon,
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
  useMantineTheme,
  Radio,
  Stack,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import React from "react";
import { parseCreatePageRoute } from "@/koala/create-page-query";

type Mode = "vibe" | "wordlist" | "csv";

const CSV_SWAP_SAMPLE_SIZE = 100;
const MIN_TERM_HANGUL_ROW_RATIO = 0.35;
const MIN_HANGUL_RATIO_GAP_TO_SWAP = 0.15;

type ParsedCsvColumns = {
  firstValue: string;
  secondValue: string;
};

function handleError(error: unknown) {
  console.error(error);
  notifications.show({
    title: "Error",
    message: "Something went wrong. Please try again.",
    color: "red",
  });
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

  const decks = await prismaClient.deck.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });

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
  useMantineTheme();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [separator, setSeparator] = React.useState(",");
  const [mode, setMode] = React.useState<Mode>("vibe");

  const [state, dispatch] = React.useReducer(reducer, {
    ...INITIAL_STATE,
    deckLang: (decks?.[0]?.langCode as LangCode) || INITIAL_STATE.deckLang,
    deckSelection: decks.length ? "existing" : "new",
    deckId: decks[0]?.id,
    deckName: decks[0]?.name || "",
  });

  const parseCards = trpc.parseCards.useMutation();
  const turbine = trpc.turbine.useMutation();
  const bulkCreate = trpc.bulkCreateCards.useMutation();
  const routeState = React.useMemo(() => {
    return parseCreatePageRoute(router.query, decks);
  }, [decks, router.query]);

  React.useEffect(() => {
    if (!router.isReady) {
      return;
    }
    if (routeState.mode) {
      setMode(routeState.mode);
    }
    if (routeState.selectedDeck) {
      dispatch({
        type: "SET_DECK_SELECTION",
        deckSelection: "existing",
      });
      dispatch({
        type: "SET_DECK_ID",
        deckId: routeState.selectedDeck.id,
      });
      dispatch({
        type: "SET_DECK_LANG",
        deckLang: routeState.selectedDeck.langCode as LangCode,
      });
      dispatch({
        type: "SET_DECK_NAME",
        deckName: routeState.selectedDeck.name,
      });
    }
    if (routeState.words.length > 0) {
      dispatch({
        type: "SET_RAW_INPUT",
        rawInput: routeState.words.join("\n"),
      });
    }
  }, [routeState, router.isReady]);

  const lines = React.useMemo(() => {
    return state.rawInput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 1500);
  }, [state.rawInput]);
  const parsedColumns = React.useMemo(
    () => lines.map((line) => parseCsvColumns(line, separator)),
    [lines, separator],
  );
  const autoSwapCsvColumns = React.useMemo(
    () =>
      shouldSwapCsvColumns(parsedColumns.slice(0, CSV_SWAP_SAMPLE_SIZE)),
    [parsedColumns],
  );
  const parsedRows = React.useMemo(
    () =>
      parsedColumns.map((columns) =>
        toCsvRow(columns, autoSwapCsvColumns),
      ),
    [parsedColumns, autoSwapCsvColumns],
  );

  const handleSubmitVibe = async () => {
    if (!state.rawInput.trim()) {
      notifications.show({
        title: "No input",
        message: "What cards shall we create?",
        color: "red",
      });
      return;
    }
    setLoading(true);
    try {
      const { cards } = await parseCards.mutateAsync({
        langCode: state.deckLang,
        text: state.rawInput,
      });
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: cards });
      notifications.show({
        title: "Generated",
        message: `Created ${cards.length} cards`,
        color: "green",
      });
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessWordlist = async () => {
    const words = state.rawInput.trim();
    if (!words) {
      notifications.show({
        title: "No words",
        message: "Add at least one word.",
        color: "red",
      });
      return;
    }
    setLoading(true);
    try {
      const result = await turbine.mutateAsync({
        words,
        langCode: state.deckLang,
      });
      const processed = result;
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: processed });
      notifications.show({
        title: "Processed",
        message: `Found ${processed.length} definitions`,
        color: "green",
      });
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessCsv = () => {
    const processed = parsedRows
      .filter((r) => r.term && r.definition)
      .map((r) => ({ ...r }));
    if (!processed.length) {
      notifications.show({
        title: "No valid rows",
        message: "Provide term and definition.",
        color: "red",
      });
      return;
    }
    dispatch({ type: "SET_PROCESSED_CARDS", processedCards: processed });
    notifications.show({
      title: "Parsed",
      message: `Parsed ${processed.length} rows`,
      color: "green",
    });
  };

  const saveCards = async () => {
    if (!state.processedCards.length) {
      return;
    }
    setLoading(true);
    try {
      const payload =
        state.deckSelection === "existing" && state.deckId
          ? { deckId: state.deckId, input: state.processedCards }
          : {
              deckName: state.deckName.trim(),
              langCode: state.deckLang,
              input: state.processedCards,
            };
      await bulkCreate.mutateAsync(
        payload as {
          deckId?: number;
          deckName?: string;
          langCode?: LangCode;
          input: {
            term: string;
            definition: string;
          }[];
        },
      );
      notifications.show({
        title: "Saved",
        message: `Added ${state.processedCards.length} cards to your deck`,
        color: "green",
      });
      router.push("/review");
    } catch (e) {
      handleError(e);
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
        deckLang: selected.langCode as LangCode,
      });
      dispatch({ type: "SET_DECK_NAME", deckName: selected.name });
    }
  };

  const canSave =
    state.processedCards.length > 0 &&
    (state.deckSelection === "existing"
      ? Boolean(state.deckId)
      : Boolean(state.deckName.trim()));

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
            autoSwapCsvColumns={autoSwapCsvColumns}
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

function parseCsvColumns(
  line: string,
  separator: string,
): ParsedCsvColumns {
  const parts = line.split(separator);
  return {
    firstValue: parts[0]?.trim() ?? "",
    secondValue: parts.slice(1).join(separator).trim(),
  };
}

function toCsvRow(columns: ParsedCsvColumns, swapColumns: boolean) {
  if (swapColumns) {
    return {
      term: columns.secondValue,
      definition: columns.firstValue,
    };
  }
  return {
    term: columns.firstValue,
    definition: columns.secondValue,
  };
}

function shouldSwapCsvColumns(rows: ParsedCsvColumns[]) {
  const rowsWithBothValues = rows.filter(
    (row) => row.firstValue && row.secondValue,
  );
  if (!rowsWithBothValues.length) {
    return false;
  }
  const firstColumnHangulRatio = getHangulRowRatio(
    rowsWithBothValues,
    "firstValue",
  );
  const secondColumnHangulRatio = getHangulRowRatio(
    rowsWithBothValues,
    "secondValue",
  );
  const firstColumnLooksNonKorean =
    firstColumnHangulRatio < MIN_TERM_HANGUL_ROW_RATIO;
  const secondColumnLooksMoreKorean =
    secondColumnHangulRatio >=
    firstColumnHangulRatio + MIN_HANGUL_RATIO_GAP_TO_SWAP;
  return firstColumnLooksNonKorean && secondColumnLooksMoreKorean;
}

function getHangulRowRatio(
  rows: ParsedCsvColumns[],
  key: keyof ParsedCsvColumns,
) {
  const hangulRows = rows.filter((row) => containsHangul(row[key])).length;
  return hangulRows / rows.length;
}

function makeDeckOptions(decks: LanguageInputPageProps["decks"]) {
  return decks.map((d) => ({
    value: String(d.id),
    label: `${d.name} (${getLangName(d.langCode)})`,
  }));
}

type DeckSectionProps = {
  deckOptions: { value: string; label: string }[];
  deckSelection: State["deckSelection"];
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

  const fields =
    deckSelection === "existing" ? (
      <Select
        data={deckOptions}
        value={deckId ? String(deckId) : null}
        onChange={onSelectExistingDeck}
        placeholder="Pick a deck"
        label="Existing deck"
      />
    ) : (
      <>
        <TextInput
          label="Deck name"
          placeholder="My Travel Phrases"
          value={deckName}
          onChange={(e) => onSetDeckName(e.currentTarget.value)}
          mb="sm"
        />
      </>
    );

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
      {fields}
    </Paper>
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
  autoSwapCsvColumns: boolean;
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
    autoSwapCsvColumns,
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
    autoSwapCsvColumns,
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
  autoSwapCsvColumns: boolean;
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
    autoSwapCsvColumns,
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
          autoSwapCsvColumns={autoSwapCsvColumns}
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
      <Group justify="space-between" align="flex-start" mb="xs" gap="sm">
        <Text size="sm" c={themeColors.gray[7]} style={{ flex: 1 }}>
          What cards shall we create? Example: "Please make 25{" "}
          {deckLangName} example sentences about food."
        </Text>
        <Button onClick={onGenerate}>Generate</Button>
      </Group>
      <Textarea
        minRows={6}
        autosize
        placeholder={`Please make 25 ${deckLangName} example sentences about travel.`}
        value={rawInput}
        onChange={(e) => setRawInput(e.currentTarget.value)}
      />
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
      <Group justify="space-between" align="flex-start" mb="xs" gap="sm">
        <Text size="sm" c={themeColors.gray[7]} style={{ flex: 1 }}>
          Paste one word per line. We’ll fetch definitions.
        </Text>
        <Button onClick={onEnrich}>Enrich</Button>
      </Group>
      <Textarea
        minRows={6}
        autosize
        placeholder={`hola\nadiós\npor favor`}
        value={rawInput}
        onChange={(e) => setRawInput(e.currentTarget.value)}
      />
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
  autoSwapCsvColumns: boolean;
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
    autoSwapCsvColumns,
    onParse,
  } = props;
  return (
    <>
      <Text size="sm" c={themeColors.gray[7]} mb="xs">
        Each line: term{separator}definition. First value is term, the rest
        is definition.
      </Text>
      {autoSwapCsvColumns ? (
        <Text size="xs" c={themeColors.gray[7]} mb="xs">
          Detected flipped columns from the first {CSV_SWAP_SAMPLE_SIZE}{" "}
          rows. Preview is auto-swapped.
        </Text>
      ) : null}
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
  return (
    <Paper withBorder p="md" radius="md" style={previewPaperStyle}>
      <Group justify="space-between" mb="md">
        <Title order={4}>Preview</Title>
        <Button onClick={onSave} disabled={!canSave}>
          Save {processedCards.length ? `(${processedCards.length})` : ""}
        </Button>
      </Group>
      {processedCards.length === 0 ? (
        <Text c="dimmed">No cards yet. Generate or parse to preview.</Text>
      ) : (
        <Stack gap={0}>
          {processedCards.map((card, index) => (
            <div key={`${card.term}-${index}`} style={previewCardStyle}>
              <Tooltip label="Remove">
                <ActionIcon
                  aria-label={`Remove card ${index + 1}`}
                  color="red"
                  variant="subtle"
                  onClick={() => onRemove(index)}
                  style={previewDeleteButtonStyle}
                >
                  <IconTrash size={16} stroke={1.8} />
                </ActionIcon>
              </Tooltip>
              <Stack gap="xs">
                <TextInput
                  label="Term"
                  value={card.term}
                  onChange={(e) =>
                    onEdit(index, "term", e.currentTarget.value)
                  }
                />
                <TextInput
                  label="Definition"
                  value={card.definition}
                  onChange={(e) =>
                    onEdit(index, "definition", e.currentTarget.value)
                  }
                />
              </Stack>
            </div>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

const previewPaperStyle: React.CSSProperties = {
  overflow: "hidden",
};

const previewCardStyle: React.CSSProperties = {
  position: "relative",
  borderTop: "1px solid var(--mantine-color-pink-1)",
  padding: "12px 40px 12px 8px",
};

const previewDeleteButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 4,
};
