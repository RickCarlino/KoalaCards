import {
  SelectedWords,
  WordDefinition,
} from "@/koala/components/writing-practice/types";

export function normalizeWordToken(raw: string) {
  return raw.replace(/[.,!?;:]$/, "").toLowerCase();
}

export function toggleSelectedWord(prev: SelectedWords, key: string) {
  if (prev[key]) {
    const { [key]: _, ...rest } = prev;
    return rest;
  }
  return { ...prev, [key]: true };
}

export function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function shouldShowLemma(word: string, lemma: string | null) {
  if (!lemma) {
    return false;
  }
  return lemma.toLowerCase() !== word.toLowerCase();
}

export function wordForCard(
  definition: Pick<WordDefinition, "word" | "lemma">,
) {
  if (shouldShowLemma(definition.word, definition.lemma)) {
    return definition.lemma ?? definition.word;
  }
  return definition.word;
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

export function buildDefinitionContextText(input: {
  prompt: string;
  essay: string;
  corrected: string;
}) {
  const blocks: string[] = [];

  if (input.prompt.trim()) {
    blocks.push(`Prompt:\n${input.prompt.trim()}`);
  }

  if (input.essay.trim()) {
    blocks.push(`Essay:\n${input.essay.trim()}`);
  }

  if (input.corrected.trim()) {
    blocks.push(`Corrected Text:\n${input.corrected.trim()}`);
  }

  return blocks.join("\n\n");
}

export function buildCreateCardsUrl(input: {
  deckId: number;
  words: string[];
}) {
  const wordsParam = encodeURIComponent(input.words.join(","));
  return `/create?mode=wordlist&deckId=${input.deckId}&words=${wordsParam}`;
}
