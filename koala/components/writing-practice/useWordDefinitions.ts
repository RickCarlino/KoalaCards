import {
  SelectedWords,
  WordDefinition,
} from "@/koala/components/writing-practice/types";
import {
  buildCreateCardsUrl,
  buildDefinitionContextText,
  normalizeWordToken,
  toErrorMessage,
  toggleSelectedWord,
  uniqueStrings,
  wordForCard,
} from "@/koala/components/writing-practice/word-utils";
import { LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import { notifications } from "@mantine/notifications";
import { useCallback, useMemo, useState } from "react";

type UseWordDefinitionsInput = {
  deckId: number;
  langCode: LangCode;
  prompt: string;
  essay: string;
  corrected: string;
};

export function useWordDefinitions({
  deckId,
  langCode,
  prompt,
  essay,
  corrected,
}: UseWordDefinitionsInput) {
  const [selectedWords, setSelectedWords] = useState<SelectedWords>({});
  const [definitions, setDefinitions] = useState<WordDefinition[]>([]);
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [definitionsError, setDefinitionsError] = useState<string | null>(
    null,
  );

  const defineWords = trpc.defineUnknownWords.useMutation();

  const reset = useCallback(() => {
    setSelectedWords({});
    setDefinitions([]);
    setDefinitionsError(null);
  }, []);

  const toggleWord = useCallback((raw: string) => {
    const key = normalizeWordToken(raw);
    if (!key) {
      return;
    }

    setSelectedWords((prev) => toggleSelectedWord(prev, key));
    setDefinitions([]);
    setDefinitionsError(null);
  }, []);

  const explain = useCallback(async () => {
    const words = Object.keys(selectedWords);
    if (!words.length) {
      notifications.show({
        title: "No Words Selected",
        message: "Click words first.",
        color: "blue",
      });
      return;
    }

    setDefinitionsError(null);
    setDefinitionsLoading(true);

    try {
      const contextText = buildDefinitionContextText({
        prompt,
        essay,
        corrected,
      });
      const result = await defineWords.mutateAsync({
        langCode,
        contextText,
        wordsToDefine: words,
      });

      setDefinitions(result.definitions);

      const count = result.definitions.length;
      notifications.show({
        title: count ? "Words Defined" : "No Definitions Found",
        message: count
          ? `Found ${count} definitions.`
          : "Could not find definitions for the selected words.",
        color: count ? "green" : "yellow",
      });
    } catch (error: unknown) {
      setDefinitionsError(
        toErrorMessage(error, "Failed to get definitions."),
      );
    } finally {
      setDefinitionsLoading(false);
    }
  }, [corrected, defineWords, essay, langCode, prompt, selectedWords]);

  const createCardsUrl = useMemo(() => {
    const words = uniqueStrings(definitions.map(wordForCard));
    if (!words.length) {
      return null;
    }
    return buildCreateCardsUrl({ deckId, words });
  }, [deckId, definitions]);

  const createCards = useCallback(() => {
    if (!createCardsUrl) {
      return;
    }
    window.open(createCardsUrl, "_blank");
  }, [createCardsUrl]);

  return {
    selectedWords,
    definitions,
    definitionsLoading,
    definitionsError,
    actions: {
      reset,
      toggleWord,
      explain,
      createCards,
    },
  };
}
