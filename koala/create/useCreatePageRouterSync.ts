import { parseWordsQuery } from "@/koala/create/create-utils";
import { findDeckFromQuery } from "@/koala/create/create-page-controller-helpers";
import { parseCreateMode, type CreateMode } from "@/koala/create/modes";
import type { DeckSummary } from "@/koala/types/create-types";
import type { NextRouter } from "next/router";
import React from "react";

export function useCreatePageRouterSync(params: {
  router: NextRouter;
  decks: DeckSummary[];
  setMode: (mode: CreateMode) => void;
  applySelectedDeck: (deck: DeckSummary) => void;
  setRawInput: (rawInput: string) => void;
}) {
  React.useEffect(() => {
    if (!params.router.isReady) {
      return;
    }

    const nextMode = parseCreateMode(params.router.query.mode);
    if (nextMode) {
      params.setMode(nextMode);
    }

    const selectedDeck = findDeckFromQuery(
      params.router.query,
      params.decks,
    );
    if (selectedDeck) {
      params.applySelectedDeck(selectedDeck);
    }

    const words = parseWordsQuery(params.router.query.words);
    if (words.length) {
      params.setRawInput(words.join("\n"));
    }
  }, [
    params.applySelectedDeck,
    params.decks,
    params.router.isReady,
    params.router.query,
    params.setMode,
    params.setRawInput,
  ]);
}
