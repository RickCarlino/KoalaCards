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
import { DEFAULT_LANG_CODE, type Gender } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import { INITIAL_STATE, reducer } from "@/koala/types/create-reducer";
import type {
  DeckSummary,
  LanguageInputPageProps,
  ParsedRow,
  State,
} from "@/koala/types/create-types";
import { useRouter } from "next/router";
import React from "react";

const DEFAULT_CARD_GENDER: Gender = "N";

type EditableField = "term" | "definition";

type CreateController = {
  loading: boolean;
  mode: CreateMode;
  setMode: (mode: CreateMode) => void;
  separator: string;
  setSeparator: (sep: string) => void;
  state: State;
  deckOptions: { value: string; label: string }[];
  lines: string[];
  parsedRows: ParsedRow[];
  canSave: boolean;
  setRawInput: (rawInput: string) => void;
  setDeckSelection: (deckSelection: State["deckSelection"]) => void;
  setDeckName: (deckName: string) => void;
  onExistingDeckChange: (val: string | null) => void;
  onEditCard: (index: number, field: EditableField, value: string) => void;
  onRemoveCard: (index: number) => void;
  onSubmitVibe: () => Promise<void>;
  onProcessWordlist: () => Promise<void>;
  onParseCsv: () => void;
  onSave: () => Promise<void>;
};

function initState(decks: LanguageInputPageProps["decks"]): State {
  const firstDeck = decks[0];
  return {
    ...INITIAL_STATE,
    deckLang: firstDeck?.langCode ?? DEFAULT_LANG_CODE,
    deckSelection: getDeckSelectionFromDecks(decks),
    deckId: firstDeck?.id,
    deckName: firstDeck?.name ?? "",
  };
}

function toLines(rawInput: string): string[] {
  return rawInput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 1500);
}

function toParsedRows(lines: string[], separator: string): ParsedRow[] {
  return lines.map((line) => {
    const parts = line.split(separator);
    const term = parts[0]?.trim() ?? "";
    const definition = parts.slice(1).join(separator).trim();
    return { term, definition };
  });
}

function getDeckFromQuery(
  query: Record<string, unknown>,
  decks: DeckSummary[],
): DeckSummary | undefined {
  const deckIdQuery = query.deckId ?? query.deck_id;
  const deckId = parseNumericId(deckIdQuery);
  if (deckId === undefined) {
    return undefined;
  }
  return decks.find((deck) => deck.id === deckId);
}

function withDefaultGender(
  card: Omit<State["processedCards"][number], "gender">,
): State["processedCards"][number] {
  return { ...card, gender: DEFAULT_CARD_GENDER };
}

export function useCreatePageController(
  decks: LanguageInputPageProps["decks"],
): CreateController {
  const router = useRouter();

  const [loading, setLoading] = React.useState(false);
  const [separator, setSeparator] = React.useState(",");
  const [mode, setMode] = React.useState<CreateMode>("vibe");

  const [state, dispatch] = React.useReducer(reducer, decks, initState);

  const parseCards = trpc.parseCards.useMutation();
  const turbine = trpc.turbine.useMutation();
  const bulkCreate = trpc.bulkCreateCards.useMutation();

  const runWithLoading = React.useCallback(
    async (action: () => Promise<void>) => {
      setLoading(true);
      try {
        await action();
      } catch {
        notifyError();
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const applySelectedDeck = React.useCallback((deck: DeckSummary) => {
    dispatch({ type: "SET_SELECTED_DECK", deck });
  }, []);

  React.useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const nextMode = parseCreateMode(router.query.mode);
    if (nextMode) {
      setMode(nextMode);
    }

    const selectedDeck = getDeckFromQuery(router.query, decks);
    if (selectedDeck) {
      applySelectedDeck(selectedDeck);
    }

    const words = parseWordsQuery(router.query.words);
    if (words.length) {
      dispatch({ type: "SET_RAW_INPUT", rawInput: words.join("\n") });
    }
  }, [applySelectedDeck, decks, router.isReady, router.query]);

  const lines = React.useMemo(
    () => toLines(state.rawInput),
    [state.rawInput],
  );
  const parsedRows = React.useMemo(
    () => toParsedRows(lines, separator),
    [lines, separator],
  );

  const deckOptions = React.useMemo(() => makeDeckOptions(decks), [decks]);
  const canSave = canSaveToDeck(state);

  const setRawInput = React.useCallback((rawInput: string) => {
    dispatch({ type: "SET_RAW_INPUT", rawInput });
  }, []);

  const setDeckSelection = React.useCallback(
    (deckSelection: State["deckSelection"]) => {
      dispatch({ type: "SET_DECK_SELECTION", deckSelection });
    },
    [],
  );

  const setDeckName = React.useCallback((deckName: string) => {
    dispatch({ type: "SET_DECK_NAME", deckName });
  }, []);

  const onExistingDeckChange = React.useCallback(
    (val: string | null) => {
      const deckId = parseNumericId(val);
      if (deckId === undefined) {
        dispatch({ type: "SET_DECK_ID", deckId: undefined });
        return;
      }

      const selectedDeck = decks.find((deck) => deck.id === deckId);
      if (!selectedDeck) {
        dispatch({ type: "SET_DECK_ID", deckId: undefined });
        return;
      }

      applySelectedDeck(selectedDeck);
    },
    [applySelectedDeck, decks],
  );

  const onEditCard = React.useCallback(
    (index: number, field: EditableField, value: string) => {
      const existing = state.processedCards[index];
      if (!existing) {
        return;
      }
      dispatch({
        type: "EDIT_CARD",
        card: { ...existing, [field]: value },
        index,
      });
    },
    [state.processedCards],
  );

  const onRemoveCard = React.useCallback((index: number) => {
    dispatch({ type: "REMOVE_CARD", index });
  }, []);

  const onSubmitVibe = React.useCallback(async () => {
    const text = state.rawInput.trim();
    if (!text) {
      notifyValidationError("No input", "What cards shall we create?");
      return;
    }

    await runWithLoading(async () => {
      const { cards } = await parseCards.mutateAsync({
        langCode: state.deckLang,
        text,
      });
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: cards });
      notifySuccess("Generated", `Created ${cards.length} cards`);
    });
  }, [parseCards, runWithLoading, state.deckLang, state.rawInput]);

  const onProcessWordlist = React.useCallback(async () => {
    const words = state.rawInput.trim();
    if (!words) {
      notifyValidationError("No words", "Add at least one word.");
      return;
    }

    await runWithLoading(async () => {
      const result = await turbine.mutateAsync({
        words,
        langCode: state.deckLang,
      });
      const processed = result.map((row) => withDefaultGender(row));
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: processed });
      notifySuccess("Processed", `Found ${processed.length} definitions`);
    });
  }, [runWithLoading, state.deckLang, state.rawInput, turbine]);

  const onParseCsv = React.useCallback(() => {
    const processed = parsedRows
      .filter((row) => row.term && row.definition)
      .map((row) => withDefaultGender(row));

    if (!processed.length) {
      notifyValidationError(
        "No valid rows",
        "Provide term and definition.",
      );
      return;
    }

    dispatch({ type: "SET_PROCESSED_CARDS", processedCards: processed });
    notifySuccess("Parsed", `Parsed ${processed.length} rows`);
  }, [parsedRows]);

  const onSave = React.useCallback(async () => {
    const payload = makeBulkCreateInput(state);
    if (!payload) {
      return;
    }

    await runWithLoading(async () => {
      await bulkCreate.mutateAsync(payload);
      notifySuccess(
        "Saved",
        `Added ${state.processedCards.length} cards to your deck`,
      );
      router.push("/review");
    });
  }, [bulkCreate, router, runWithLoading, state]);

  return {
    loading,
    mode,
    setMode,
    separator,
    setSeparator,
    state,
    deckOptions,
    lines,
    parsedRows,
    canSave,
    setRawInput,
    setDeckSelection,
    setDeckName,
    onExistingDeckChange,
    onEditCard,
    onRemoveCard,
    onSubmitVibe,
    onProcessWordlist,
    onParseCsv,
    onSave,
  };
}
