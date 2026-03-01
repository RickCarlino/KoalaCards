import { notifications } from "@mantine/notifications";
import React, { useMemo, useState } from "react";
import { trpc } from "@/koala/trpc-config";
import type { ReaderArticleSummary } from "./types";

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function useReaderDashboardControls() {
  const [articleUrl, setArticleUrl] = useState("");
  const [rawTitle, setRawTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [deletingPublicId, setDeletingPublicId] = useState<string | null>(
    null,
  );

  const listQuery = trpc.listReaderArticlesRoute.useQuery(
    { limit: 40 },
    {
      refetchOnWindowFocus: false,
      refetchInterval: (data) => {
        const hasActiveIngest = (data?.articles ?? []).some((article) => {
          return (
            article.ingestStatus === "pending" ||
            article.ingestStatus === "in_progress"
          );
        });

        if (hasActiveIngest) {
          return 8000;
        }

        return false;
      },
    },
  );

  const saveUrlArticle = trpc.saveReaderArticleRoute.useMutation();
  const saveRawTextArticle = trpc.saveReaderRawTextRoute.useMutation();
  const deleteArticle = trpc.deleteReaderArticleRoute.useMutation();

  const listErrorMessage = useMemo(() => {
    if (!listQuery.isError) {
      return null;
    }

    return mutationErrorMessage(
      listQuery.error,
      "Could not load reader articles.",
    );
  }, [listQuery.error, listQuery.isError]);

  const handleSaveUrlSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const trimmed = articleUrl.trim();
    if (!trimmed) {
      notifications.show({
        title: "Missing URL",
        message: "Please paste an article URL.",
        color: "red",
      });
      return;
    }

    try {
      const result = await saveUrlArticle.mutateAsync({ url: trimmed });
      setArticleUrl("");
      notifications.show({
        title: "Queued",
        message: `Article #${result.article.id} queued for processing.`,
        color: "green",
      });
      listQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Save failed",
        message: mutationErrorMessage(
          error,
          "Could not save article URL.",
        ),
        color: "red",
      });
    }
  };

  const handleSaveRawTextSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!rawText.trim()) {
      notifications.show({
        title: "Missing text",
        message: "Please paste text to save.",
        color: "red",
      });
      return;
    }

    try {
      const result = await saveRawTextArticle.mutateAsync({
        title: rawTitle.trim() || undefined,
        text: rawText,
      });
      setRawTitle("");
      setRawText("");
      notifications.show({
        title: "Saved",
        message: `Text #${result.article.id} is ready in your library.`,
        color: "green",
      });
      listQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Save failed",
        message: mutationErrorMessage(error, "Could not save raw text."),
        color: "red",
      });
    }
  };

  const handleDeleteArticle = async (
    article: ReaderArticleSummary,
  ): Promise<void> => {
    const shouldDelete = window.confirm(
      `Delete "${article.title}" from your library?`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingPublicId(article.publicId);

    try {
      await deleteArticle.mutateAsync({ publicId: article.publicId });
      notifications.show({
        title: "Deleted",
        message: "Article removed from your library.",
        color: "green",
      });
      listQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Delete failed",
        message: mutationErrorMessage(error, "Could not delete article."),
        color: "red",
      });
    } finally {
      setDeletingPublicId((current) => {
        if (current === article.publicId) {
          return null;
        }

        return current;
      });
    }
  };

  return {
    articleUrl,
    rawTitle,
    rawText,
    deletingPublicId,
    isSavingUrl: saveUrlArticle.isLoading,
    isSavingRaw: saveRawTextArticle.isLoading,
    articles: listQuery.data?.articles ?? [],
    isArticlesLoading: listQuery.isLoading,
    isArticlesRefreshing: listQuery.isFetching,
    listErrorMessage,
    onArticleUrlChange: setArticleUrl,
    onRawTitleChange: setRawTitle,
    onRawTextChange: setRawText,
    onDeleteArticle: handleDeleteArticle,
    onSaveUrlSubmit: handleSaveUrlSubmit,
    onSaveRawTextSubmit: handleSaveRawTextSubmit,
    onRefreshArticles: () => listQuery.refetch(),
  };
}
