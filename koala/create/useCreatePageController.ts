import {
  canSaveToDeck,
  makeBulkCreateInput,
  makeDeckOptions,
} from "@/koala/create/create-utils";
import {
  findDeckByInput,
  initCreateState,
  toInputLines,
  toParsedRows,
  toProcessedCardsFromParsedRows,
  withDefaultGender,
} from "@/koala/create/create-page-controller-helpers";
import type {
  CreateController,
  EditableField,
} from "@/koala/create/create-page-controller-types";
import type { CreateMode } from "@/koala/create/modes";
import {
  notifySuccess,
  notifyValidationError,
} from "@/koala/create/notify";
import { useCreatePageRouterSync } from "@/koala/create/useCreatePageRouterSync";
import { useRunWithLoading } from "@/koala/create/useRunWithLoading";
import { trpc } from "@/koala/trpc-config";
import { reducer } from "@/koala/types/create-reducer";
import type {
  DeckSummary,
  LanguageInputPageProps,
  State,
} from "@/koala/types/create-types";
import { useRouter } from "next/router";
import React from "react";

export function useCreatePageController(
  decks: LanguageInputPageProps["decks"],
): CreateController {
  const router = useRouter();

  const [separator, setSeparator] = React.useState(",");
  const [mode, setMode] = React.useState<CreateMode>("vibe");

  const [state, dispatch] = React.useReducer(
    reducer,
    decks,
    initCreateState,
  );

  const { loading, runWithLoading } = useRunWithLoading();

  const parseCards = trpc.parseCards.useMutation();
  const turbine = trpc.turbine.useMutation();
  const bulkCreate = trpc.bulkCreateCards.useMutation();

  const applySelectedDeck = React.useCallback((deck: DeckSummary) => {
    dispatch({ type: "SET_SELECTED_DECK", deck });
  }, []);

  const setRawInput = React.useCallback((rawInput: string) => {
    dispatch({ type: "SET_RAW_INPUT", rawInput });
  }, []);

  useCreatePageRouterSync({
    router,
    decks,
    setMode,
    applySelectedDeck,
    setRawInput,
  });

  const lines = React.useMemo(
    () => toInputLines(state.rawInput),
    [state.rawInput],
  );
  const parsedRows = React.useMemo(
    () => toParsedRows(lines, separator),
    [lines, separator],
  );

  const deckOptions = React.useMemo(() => makeDeckOptions(decks), [decks]);
  const canSave = canSaveToDeck(state);

  const setDeckSelection = React.useCallback(
    (deckSelection: State["deckSelection"]) => {
      dispatch({ type: "SET_DECK_SELECTION", deckSelection });
    },
    [],
  );

  const setDeckName = React.useCallback((deckName: string) => {
    dispatch({ type: "SET_DECK_NAME", deckName });
  }, []);

  const clearSelectedDeck = React.useCallback(() => {
    dispatch({ type: "SET_DECK_ID", deckId: undefined });
  }, []);

  const onExistingDeckChange = React.useCallback(
    (val: string | null) => {
      const selectedDeck = findDeckByInput(decks, val);
      if (!selectedDeck) {
        clearSelectedDeck();
        return;
      }
      applySelectedDeck(selectedDeck);
    },
    [applySelectedDeck, clearSelectedDeck, decks],
  );

  const onEditCard = React.useCallback(
    (index: number, field: EditableField, value: string) => {
      dispatch({ type: "EDIT_CARD_FIELD", index, field, value });
    },
    [],
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
    const processed = toProcessedCardsFromParsedRows(parsedRows);

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
