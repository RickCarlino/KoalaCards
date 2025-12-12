import { DeckSection } from "@/koala/create/components/DeckSection";
import { ContentSection } from "@/koala/create/components/ContentSection";
import { PreviewSection } from "@/koala/create/components/PreviewSection";
import {
  canSaveToDeck,
  getDeckSelectionFromDecks,
  makeBulkCreateInput,
  makeDeckOptions,
  parseNumericId,
  parseWordsQuery,
} from "@/koala/create/create-utils";
import { parseCreateMode, type CreateMode } from "@/koala/create/modes";
import {
  notifyError,
  notifySuccess,
  notifyValidationError,
} from "@/koala/create/notify";
import { backfillDecks } from "@/koala/decks/backfill-decks";
import { getLangName } from "@/koala/get-lang-name";
import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { DEFAULT_LANG_CODE, type Gender } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import { INITIAL_STATE, reducer } from "@/koala/types/create-reducer";
import type {
  DeckSummary,
  LanguageInputPageProps,
} from "@/koala/types/create-types";
import {
  Container,
  Grid,
  Loader,
  Overlay,
  Text,
  Title,
} from "@mantine/core";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import React from "react";

const DEFAULT_CARD_GENDER: Gender = "N";

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
        langCode: DEFAULT_LANG_CODE,
      })),
    },
  };
};

export default function CreatePage(props: LanguageInputPageProps) {
  const { decks } = props;
  const router = useRouter();

  const firstDeck = decks[0];
  const [loading, setLoading] = React.useState(false);
  const [separator, setSeparator] = React.useState(",");
  const [mode, setMode] = React.useState<CreateMode>("vibe");

  const [state, dispatch] = React.useReducer(reducer, {
    ...INITIAL_STATE,
    deckLang: firstDeck?.langCode ?? INITIAL_STATE.deckLang,
    deckSelection: getDeckSelectionFromDecks(decks),
    deckId: firstDeck?.id,
    deckName: firstDeck?.name || "",
  });

  const applySelectedDeck = (deck: DeckSummary) => {
    dispatch({ type: "SET_SELECTED_DECK", deck });
  };

  const getDeckFromQuery = () => {
    const deckIdQuery = router.query.deckId ?? router.query.deck_id;
    const deckId = parseNumericId(deckIdQuery);
    if (deckId === undefined) {
      return undefined;
    }
    return decks.find((deck) => deck.id === deckId);
  };

  const parseCards = trpc.parseCards.useMutation();
  const turbine = trpc.turbine.useMutation();
  const bulkCreate = trpc.bulkCreateCards.useMutation();

  React.useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const nextMode = parseCreateMode(router.query.mode);
    if (nextMode) {
      setMode(nextMode);
    }

    const selectedDeck = getDeckFromQuery();
    if (selectedDeck) {
      applySelectedDeck(selectedDeck);
    }

    const words = parseWordsQuery(router.query.words);
    if (words.length) {
      dispatch({ type: "SET_RAW_INPUT", rawInput: words.join("\n") });
    }
  }, [router.isReady, router.query, decks]);

  const lines = React.useMemo(() => {
    return state.rawInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 1500);
  }, [state.rawInput]);

  const parsedRows = React.useMemo(() => {
    return lines.map((line) => {
      const parts = line.split(separator);
      const term = parts[0]?.trim() ?? "";
      const definition = parts.slice(1).join(separator).trim();
      return { term, definition };
    });
  }, [lines, separator]);

  const handleSubmitVibe = async () => {
    if (!state.rawInput.trim()) {
      notifyValidationError("No input", "What cards shall we create?");
      return;
    }

    setLoading(true);
    try {
      const { cards } = await parseCards.mutateAsync({
        langCode: state.deckLang,
        text: state.rawInput,
      });
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: cards });
      notifySuccess("Generated", `Created ${cards.length} cards`);
    } catch {
      notifyError();
    } finally {
      setLoading(false);
    }
  };

  const handleProcessWordlist = async () => {
    const words = state.rawInput.trim();
    if (!words) {
      notifyValidationError("No words", "Add at least one word.");
      return;
    }

    setLoading(true);
    try {
      const result = await turbine.mutateAsync({
        words,
        langCode: state.deckLang,
      });
      const processed = result.map((row) => ({
        ...row,
        gender: DEFAULT_CARD_GENDER,
      }));
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: processed });
      notifySuccess("Processed", `Found ${processed.length} definitions`);
    } catch {
      notifyError();
    } finally {
      setLoading(false);
    }
  };

  const handleProcessCsv = () => {
    const processed = parsedRows
      .filter((row) => row.term && row.definition)
      .map((row) => ({ ...row, gender: DEFAULT_CARD_GENDER }));

    if (!processed.length) {
      notifyValidationError(
        "No valid rows",
        "Provide term and definition.",
      );
      return;
    }

    dispatch({ type: "SET_PROCESSED_CARDS", processedCards: processed });
    notifySuccess("Parsed", `Parsed ${processed.length} rows`);
  };

  const saveCards = async () => {
    const payload = makeBulkCreateInput(state);
    if (!payload) {
      return;
    }

    setLoading(true);
    try {
      await bulkCreate.mutateAsync(payload);
      notifySuccess(
        "Saved",
        `Added ${state.processedCards.length} cards to your deck`,
      );
      router.push("/review");
    } catch {
      notifyError();
    } finally {
      setLoading(false);
    }
  };

  const deckOptions = React.useMemo(() => makeDeckOptions(decks), [decks]);
  const canSave = canSaveToDeck(state);

  const onExistingDeckChange = (val: string | null) => {
    const deckId = parseNumericId(val);
    if (deckId === undefined) {
      dispatch({ type: "SET_DECK_ID", deckId });
      return;
    }

    const selectedDeck = decks.find((deck) => deck.id === deckId);
    if (!selectedDeck) {
      dispatch({ type: "SET_DECK_ID", deckId: undefined });
      return;
    }

    applySelectedDeck(selectedDeck);
  };

  const onEditCard = (
    index: number,
    field: "term" | "definition",
    value: string,
  ) => {
    const existing = state.processedCards[index];
    if (!existing) {
      return;
    }
    dispatch({
      type: "EDIT_CARD",
      card: { ...existing, [field]: value },
      index,
    });
  };

  return (
    <Container size="lg" py="lg" style={{ position: "relative" }}>
      {loading ? (
        <Overlay blur={2} opacity={0.6} color="#fff" zIndex={9999}>
          <Loader size="lg" variant="dots" />
        </Overlay>
      ) : null}

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
            onSetSelection={(deckSelection) =>
              dispatch({ type: "SET_DECK_SELECTION", deckSelection })
            }
            onSetDeckName={(deckName) =>
              dispatch({ type: "SET_DECK_NAME", deckName })
            }
          />

          <ContentSection
            deckLangName={getLangName(state.deckLang)}
            linesCount={lines.length}
            mode={mode}
            parsedRows={parsedRows}
            rawInput={state.rawInput}
            separator={separator}
            setMode={setMode}
            setRawInput={(rawInput) =>
              dispatch({ type: "SET_RAW_INPUT", rawInput })
            }
            setSeparator={setSeparator}
            onParseCsv={handleProcessCsv}
            onProcessWordlist={handleProcessWordlist}
            onSubmitVibe={handleSubmitVibe}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <PreviewSection
            canSave={canSave}
            onEdit={onEditCard}
            onRemove={(index) => dispatch({ type: "REMOVE_CARD", index })}
            onSave={saveCards}
            processedCards={state.processedCards}
          />
        </Grid.Col>
      </Grid>
    </Container>
  );
}
