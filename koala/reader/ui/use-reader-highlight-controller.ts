import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/koala/trpc-config";
import {
  buildReaderExplainPayload,
  shouldAutoExplainSelection,
  type ReaderHighlight,
  type ReaderHighlightAnalysis,
  type ReaderHighlightImportStatus,
  type ReaderResource,
  type ReaderSelectionDraft,
  type ReaderToolsPanel,
} from "../contracts";
import {
  allReaderHighlightsSelected,
  importableReaderHighlightIds,
  mergeReaderHighlightImportStatuses,
  readerHighlightImportSummaryMessage,
  toggleAllReaderHighlights,
  toggleReaderHighlightSelection,
} from "../highlight-controller-state";
import { readReaderExplainStream } from "../sse-client";
import {
  isCurrentReaderRequest,
  nextReaderRequestId,
} from "../request-state";

export type ReaderOptimisticHighlight = {
  id: number;
  draft: ReaderSelectionDraft;
};

type ActivateReaderHighlightOptions = {
  navigate?: boolean;
  retryDraft?: ReaderSelectionDraft | null;
};

export function useReaderHighlightController(options: {
  resource: ReaderResource;
  enabled?: boolean;
  onNavigateToHighlight?: (highlight: ReaderHighlight) => void;
}) {
  const resource = useMemo<ReaderResource>(
    () => ({
      kind: options.resource.kind,
      publicId: options.resource.publicId,
    }),
    [options.resource.kind, options.resource.publicId],
  );
  const onNavigateToHighlight = options.onNavigateToHighlight;
  const [activePanel, setActivePanel] =
    useState<ReaderToolsPanel>("current");
  const [selectionDraft, setSelectionDraft] =
    useState<ReaderSelectionDraft | null>(null);
  const [retryDraft, setRetryDraft] =
    useState<ReaderSelectionDraft | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<
    number | null
  >(null);
  const [analysis, setAnalysis] = useState<ReaderHighlightAnalysis | null>(
    null,
  );
  const [streamError, setStreamError] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(
    null,
  );
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<
    number[]
  >([]);
  const [importStatusByHighlightId, setImportStatusByHighlightId] =
    useState<Record<number, ReaderHighlightImportStatus>>({});
  const [deletingHighlightId, setDeletingHighlightId] = useState<
    number | null
  >(null);
  const [isImportingSelected, setIsImportingSelected] = useState(false);
  const [isImportingCurrent, setIsImportingCurrent] = useState(false);
  const [optimisticHighlight, setOptimisticHighlight] =
    useState<ReaderOptimisticHighlight | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const optimisticIdRef = useRef(-1);

  const workspaceQuery = trpc.getReaderWorkspaceRoute.useQuery(
    { resource },
    {
      enabled: options.enabled ?? true,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const deleteMutation = trpc.deleteReaderHighlightRoute.useMutation({
    retry: false,
  });
  const importMutation =
    trpc.importReaderHighlightsToDeckRoute.useMutation({
      retry: false,
    });

  const highlights = useMemo(() => {
    return workspaceQuery.data?.highlights ?? [];
  }, [workspaceQuery.data?.highlights]);
  const decks = useMemo(() => {
    return workspaceQuery.data?.decks ?? [];
  }, [workspaceQuery.data?.decks]);
  const importableIds = useMemo(
    () => importableReaderHighlightIds(highlights),
    [highlights],
  );
  const activeHighlight = useMemo(() => {
    if (activeHighlightId === null) {
      return null;
    }
    return (
      highlights.find((highlight) => highlight.id === activeHighlightId) ??
      null
    );
  }, [activeHighlightId, highlights]);
  const allImportableSelected = allReaderHighlightsSelected({
    selectedIds: selectedHighlightIds,
    importableIds,
  });

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (selectedDeckId !== null || decks.length === 0) {
      return;
    }
    setSelectedDeckId(String(decks[0].id));
  }, [decks, selectedDeckId]);

  useEffect(() => {
    const importableIdSet = new Set(importableIds);
    setSelectedHighlightIds((current) => {
      return current.filter((id) => importableIdSet.has(id));
    });
  }, [importableIds]);

  useEffect(() => {
    if (
      optimisticHighlight &&
      highlights.some(
        (highlight) => highlight.id === optimisticHighlight.id,
      )
    ) {
      setOptimisticHighlight(null);
    }
  }, [highlights, optimisticHighlight]);

  const cancelExplanation = useCallback(() => {
    requestIdRef.current = nextReaderRequestId(requestIdRef.current);
    abortRef.current?.abort();
    abortRef.current = null;
    setIsExplaining(false);
    setOptimisticHighlight(null);
  }, []);

  const explainDraft = useCallback(
    async (draft: ReaderSelectionDraft, retry = false) => {
      const requestId = nextReaderRequestId(requestIdRef.current);
      const controller = new AbortController();
      const isCurrent = () => {
        return isCurrentReaderRequest({
          activeRequestId: requestIdRef.current,
          requestId,
          aborted: controller.signal.aborted,
        });
      };
      let receivedHighlightId = false;
      const optimisticId = optimisticIdRef.current;
      optimisticIdRef.current -= 1;
      requestIdRef.current = requestId;
      abortRef.current?.abort();
      abortRef.current = controller;

      setActivePanel("current");
      setSelectionDraft(draft);
      setRetryDraft(draft);
      setActiveHighlightId(null);
      setAnalysis(null);
      setStreamError("");
      setIsExplaining(true);
      setOptimisticHighlight({ id: optimisticId, draft });

      try {
        const response = await fetch(
          "/api/reader/highlight-explain-stream",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              buildReaderExplainPayload({
                resource,
                draft,
                retry,
              }),
            ),
            signal: controller.signal,
          },
        );
        await readReaderExplainStream(response, {
          onHighlightId: (highlightId) => {
            if (!isCurrent()) {
              return;
            }
            receivedHighlightId = true;
            setActiveHighlightId(highlightId);
            setOptimisticHighlight({ id: highlightId, draft });
          },
          onAnalysis: (nextAnalysis) => {
            if (isCurrent()) {
              setAnalysis(nextAnalysis);
            }
          },
          onError: (message) => {
            if (isCurrent()) {
              setStreamError(message);
            }
          },
          onDone: () => {
            if (isCurrent()) {
              setIsExplaining(false);
            }
          },
        });
        if (isCurrent()) {
          await workspaceQuery.refetch();
        }
      } catch (error) {
        if (isCurrent()) {
          if (!receivedHighlightId) {
            setOptimisticHighlight(null);
          }
          setStreamError(
            error instanceof Error
              ? error.message
              : "Unable to explain this selection.",
          );
        }
      } finally {
        if (isCurrent()) {
          setIsExplaining(false);
        }
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [resource, workspaceQuery],
  );

  const selectDraft = useCallback(
    (draft: ReaderSelectionDraft | null) => {
      cancelExplanation();
      setSelectionDraft(draft);
      if (!draft) {
        return;
      }

      setActivePanel("current");
      setActiveHighlightId(null);
      setAnalysis(null);
      setStreamError("");
      if (shouldAutoExplainSelection(draft.selectedText)) {
        void explainDraft(draft);
      }
    },
    [cancelExplanation, explainDraft],
  );

  const activateHighlight = useCallback(
    (
      highlight: ReaderHighlight,
      activateOptions: ActivateReaderHighlightOptions = {},
    ) => {
      cancelExplanation();
      setSelectionDraft(null);
      setRetryDraft(activateOptions.retryDraft ?? null);
      setActiveHighlightId(highlight.id);
      setAnalysis(
        highlight.status === "ready"
          ? {
              term: highlight.term,
              definition: highlight.definition,
              generalMeaning: highlight.generalMeaning,
              meaningInContext: highlight.meaningInContext,
            }
          : null,
      );
      setStreamError(
        highlight.status === "error" ? highlight.errorMessage : "",
      );
      setActivePanel("current");
      if (activateOptions.navigate) {
        onNavigateToHighlight?.(highlight);
      }
    },
    [cancelExplanation, onNavigateToHighlight],
  );

  const deleteHighlight = useCallback(
    async (highlightId: number) => {
      setDeletingHighlightId(highlightId);
      try {
        await deleteMutation.mutateAsync({
          resource,
          highlightId,
        });
        setSelectedHighlightIds((current) => {
          return current.filter((id) => id !== highlightId);
        });
        if (activeHighlightId === highlightId) {
          setActiveHighlightId(null);
          setAnalysis(null);
          setSelectionDraft(null);
          setRetryDraft(null);
          setStreamError("");
        }
        await workspaceQuery.refetch();
      } catch (error) {
        notifications.show({
          title: "Delete failed",
          message:
            error instanceof Error
              ? error.message
              : "Couldn't delete this highlight.",
          color: "red",
        });
      } finally {
        setDeletingHighlightId(null);
      }
    },
    [activeHighlightId, deleteMutation, resource, workspaceQuery],
  );

  const importHighlightIds = useCallback(
    async (highlightIds: number[]) => {
      if (!selectedDeckId || highlightIds.length === 0) {
        return null;
      }

      const result = await importMutation.mutateAsync({
        resource,
        deckId: Number(selectedDeckId),
        highlightIds,
      });
      setImportStatusByHighlightId((current) => {
        return mergeReaderHighlightImportStatuses(current, result.results);
      });
      await workspaceQuery.refetch();
      return result;
    },
    [importMutation, resource, selectedDeckId, workspaceQuery],
  );

  const importSelected = useCallback(async () => {
    setIsImportingSelected(true);
    try {
      const ids =
        selectedHighlightIds.length > 0
          ? selectedHighlightIds
          : importableIds;
      const result = await importHighlightIds(ids);
      if (result) {
        notifications.show({
          title: "Add complete",
          message: readerHighlightImportSummaryMessage(result.summary),
          color: result.summary.created > 0 ? "green" : "gray",
        });
        setSelectedHighlightIds([]);
      }
    } catch (error) {
      notifications.show({
        title: "Add failed",
        message:
          error instanceof Error
            ? error.message
            : "Couldn't add highlights.",
        color: "red",
      });
    } finally {
      setIsImportingSelected(false);
    }
  }, [importHighlightIds, importableIds, selectedHighlightIds]);

  const importCurrent = useCallback(async () => {
    if (!activeHighlight) {
      return;
    }
    setIsImportingCurrent(true);
    try {
      const result = await importHighlightIds([activeHighlight.id]);
      const status = result?.results[0]?.status;
      if (status) {
        notifications.show({
          title: "Add to deck",
          message: readerHighlightImportSummaryMessage(result.summary),
          color: status === "created" ? "green" : "gray",
        });
      }
    } catch (error) {
      notifications.show({
        title: "Add failed",
        message:
          error instanceof Error
            ? error.message
            : "Couldn't add this highlight.",
        color: "red",
      });
    } finally {
      setIsImportingCurrent(false);
    }
  }, [activeHighlight, importHighlightIds]);

  return {
    activePanel,
    setActivePanel,
    selectionDraft,
    selectDraft,
    retryDraft,
    explainCurrent: () => {
      if (selectionDraft) {
        void explainDraft(selectionDraft);
      }
    },
    retryCurrent: () => {
      if (retryDraft) {
        void explainDraft(retryDraft, true);
      }
    },
    activeHighlight,
    activeHighlightId,
    analysis,
    streamError,
    isExplaining,
    optimisticHighlight,
    highlights,
    decks,
    workspaceQuery,
    selectedDeckId,
    setSelectedDeckId,
    selectedHighlightIds,
    importableIds,
    allImportableSelected,
    importStatusByHighlightId,
    deletingHighlightId,
    isImportingSelected,
    isImportingCurrent,
    canImportSelected:
      selectedDeckId !== null &&
      importableIds.length > 0 &&
      !isImportingSelected,
    canImportCurrent:
      activeHighlight?.status === "ready" &&
      activeHighlight.importedCardId === null &&
      selectedDeckId !== null &&
      !isExplaining,
    activateHighlight,
    deleteHighlight,
    importSelected,
    importCurrent,
    toggleHighlightSelection: (highlightId: number, selected: boolean) => {
      setSelectedHighlightIds((current) => {
        return toggleReaderHighlightSelection({
          selectedIds: current,
          highlightId,
          selected,
        });
      });
    },
    toggleSelectAll: () => {
      setSelectedHighlightIds((current) => {
        return toggleAllReaderHighlights({
          selectedIds: current,
          importableIds,
        });
      });
    },
  };
}

export type ReaderHighlightController = ReturnType<
  typeof useReaderHighlightController
>;
