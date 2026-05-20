export type ExplainSelectionDraft = {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  occurrenceHint: number;
};

export function canExplainSelection(
  draft: ExplainSelectionDraft | null,
  isExplaining: boolean,
): draft is ExplainSelectionDraft {
  return Boolean(draft) && !isExplaining;
}

export function hasExplainSelectionStream(
  response: Response,
): response is Response & { body: ReadableStream<Uint8Array> } {
  return response.ok && response.body !== null;
}

export function buildExplainSelectionPayload(
  publicId: string,
  draft: ExplainSelectionDraft,
) {
  return {
    publicId,
    selectedText: draft.selectedText,
    contextBefore: draft.contextBefore,
    contextAfter: draft.contextAfter,
    occurrenceHint: draft.occurrenceHint,
  };
}

export function resolveExplainSelectionErrorMessage(
  error: unknown,
  aborted: boolean,
): string | null {
  if (aborted) {
    return null;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to stream explanation.";
}

export function findExplainedHighlightMatch<
  THighlight extends { id: number },
>(
  highlights: THighlight[],
  draft: ExplainSelectionDraft,
  findMatchingHighlightId: (
    highlights: THighlight[],
    draft: ExplainSelectionDraft,
  ) => number | null,
) {
  const matchedHighlightId = findMatchingHighlightId(highlights, draft);
  if (matchedHighlightId === null) {
    return {
      matchedHighlightId: null,
      matchedHighlight: null,
    };
  }

  return {
    matchedHighlightId,
    matchedHighlight:
      highlights.find(
        (highlight) => highlight.id === matchedHighlightId,
      ) ?? null,
  };
}
