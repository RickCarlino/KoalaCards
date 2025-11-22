import { backfillDecks } from "@/koala/decks/backfill-decks";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { LangCode, supportedLanguages } from "@/koala/shared-types";
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
  useMantineTheme,
  Radio,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import React from "react";

type Mode = "vibe" | "wordlist" | "csv";

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

  React.useEffect(() => {
    if (!router.isReady) {
      return;
    }
    const m = router.query.mode;
    if (
      typeof m === "string" &&
      (m === "vibe" || m === "wordlist" || m === "csv")
    ) {
      setMode(m);
    }
    const qDeckId = router.query.deckId ?? router.query.deck_id;
    if (typeof qDeckId === "string") {
      const parsed = Number(qDeckId);
      if (!Number.isNaN(parsed)) {
        const selected = decks.find((d) => d.id === parsed);
        if (selected) {
          dispatch({
            type: "SET_DECK_SELECTION",
            deckSelection: "existing",
          });
          dispatch({ type: "SET_DECK_ID", deckId: selected.id });
          dispatch({
            type: "SET_DECK_LANG",
            deckLang: selected.langCode as LangCode,
          });
          dispatch({ type: "SET_DECK_NAME", deckName: selected.name });
        }
      }
    }
    const words = router.query.words;
    if (typeof words === "string") {
      const decoded = decodeURIComponent(words);
      const arr = decoded
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);
      if (arr.length) {
        dispatch({ type: "SET_RAW_INPUT", rawInput: arr.join("\n") });
      }
    }
  }, [router.isReady, router.query.mode, router.query.words]);

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
      const processed = result.map((r) => ({
        ...r,
        gender: "N" as const,
      }));
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
      .map((r) => ({ ...r, gender: "N" as const }));
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
            gender: "M" | "F" | "N";
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
            deckLang={state.deckLang}
            onSelectExistingDeck={onExistingDeckChange}
            onSetSelection={(sel) =>
              dispatch({ type: "SET_DECK_SELECTION", deckSelection: sel })
            }
            onSetDeckName={(name) =>
              dispatch({ type: "SET_DECK_NAME", deckName: name })
            }
            onSetLang={(code) =>
              dispatch({ type: "SET_DECK_LANG", deckLang: code })
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

type DeckSectionProps = {
  deckOptions: { value: string; label: string }[];
  deckSelection: State["deckSelection"];
  deckId?: number;
  deckName: string;
  deckLang: LangCode;
  onSelectExistingDeck: (val: string | null) => void;
  onSetSelection: (sel: "existing" | "new") => void;
  onSetDeckName: (name: string) => void;
  onSetLang: (code: LangCode) => void;
};

function DeckSection(props: DeckSectionProps) {
  const {
    deckOptions,
    deckSelection,
    deckId,
    deckName,
    deckLang,
    onSelectExistingDeck,
    onSetSelection,
    onSetDeckName,
    onSetLang,
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
        <Select
          label="Language"
          placeholder="Select language"
          value={deckLang}
          onChange={(v) => onSetLang((v as LangCode) || deckLang)}
          data={[{ value: "ko", label: supportedLanguages.ko }]}
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
        What cards shall we create? Example: "Please make 25 {deckLangName}{" "}
        example sentences about food."
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
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Title order={4}>Preview</Title>
        <Button onClick={onSave} disabled={!canSave}>
          Save {processedCards.length ? `(${processedCards.length})` : ""}
        </Button>
      </Group>
      {processedCards.length === 0 ? (
        <Text c="dimmed">No cards yet. Generate or parse to preview.</Text>
      ) : (
        processedCards.map((card, index) => (
          <Group
            key={`${card.term}-${index}`}
            grow
            align="flex-end"
            mb="sm"
          >
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
            <Button
              color="red"
              variant="light"
              onClick={() => onRemove(index)}
            >
              Remove
            </Button>
          </Group>
        ))
      )}
    </Paper>
  );
}
