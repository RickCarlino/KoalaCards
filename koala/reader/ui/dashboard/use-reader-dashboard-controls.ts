import { notifications } from "@mantine/notifications";
import React, { useMemo, useState } from "react";
import { trpc } from "@/koala/trpc-config";
import type { ReaderArticleSummary, ReaderReadFilter } from "./types";

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function articleMatchesReadFilter(
  article: ReaderArticleSummary,
  readFilter: ReaderReadFilter,
): boolean {
  if (readFilter === "all") {
    return true;
  }

  if (readFilter === "read") {
    return article.readAt !== null;
  }

  return article.readAt === null;
}

export function useReaderDashboardControls() {
  const [articleUrl, setArticleUrl] = useState("");
  const [rawTitle, setRawTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [readFilter, setReadFilter] = useState<ReaderReadFilter>("unread");
  const [deletingPublicId, setDeletingPublicId] = useState<string | null>(
    null,
  );
  const [updatingReadPublicId, setUpdatingReadPublicId] = useState<
    string | null
  >(null);

  const listQuery = trpc.listReaderArticlesRoute.useQuery(
    { limit: 200 },
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
  const setReaderArticleReadState =
    trpc.setReaderArticleReadStateRoute.useMutation();

  const listErrorMessage = useMemo(() => {
    if (!listQuery.isError) {
      return null;
    }

    return mutationErrorMessage(
      listQuery.error,
      "Couldn't load your Reader library.",
    );
  }, [listQuery.error, listQuery.isError]);

  const allArticles = useMemo<ReaderArticleSummary[]>(() => {
    return listQuery.data?.articles ?? [];
  }, [listQuery.data]);

  const articles = useMemo(() => {
    return allArticles.filter((article) => {
      return articleMatchesReadFilter(article, readFilter);
    });
  }, [allArticles, readFilter]);

  const readArticlesCount = useMemo(() => {
    return allArticles.filter((article) => article.readAt !== null).length;
  }, [allArticles]);

  const unreadArticlesCount = useMemo(() => {
    return allArticles.length - readArticlesCount;
  }, [allArticles.length, readArticlesCount]);

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
      await saveUrlArticle.mutateAsync({ url: trimmed });
      setArticleUrl("");
      notifications.show({
        title: "Saved to Reader",
        message: "We are preparing this article now.",
        color: "green",
      });
      listQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Save failed",
        message: mutationErrorMessage(
          error,
          "Couldn't save that URL.",
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
      await saveRawTextArticle.mutateAsync({
        title: rawTitle.trim() || undefined,
        text: rawText,
      });
      setRawTitle("");
      setRawText("");
      notifications.show({
        title: "Added to Reader",
        message: "Text saved to your library.",
        color: "green",
      });
      listQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Save failed",
        message: mutationErrorMessage(error, "Couldn't save this text."),
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
        message: mutationErrorMessage(
          error,
          "Couldn't delete this article.",
        ),
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

  const handleToggleReadState = async (
    article: ReaderArticleSummary,
  ): Promise<void> => {
    const markAsRead = article.readAt === null;
    setUpdatingReadPublicId(article.publicId);

    try {
      await setReaderArticleReadState.mutateAsync({
        publicId: article.publicId,
        read: markAsRead,
      });
      notifications.show({
        title: markAsRead ? "Marked as read" : "Marked as unread",
        message: markAsRead
          ? "Moved to Read."
          : "Moved back to Unread.",
        color: "green",
      });
      listQuery.refetch();
    } catch (error: unknown) {
      notifications.show({
        title: "Update failed",
        message: mutationErrorMessage(
          error,
          "Couldn't update read status.",
        ),
        color: "red",
      });
    } finally {
      setUpdatingReadPublicId((current) => {
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
    readFilter,
    deletingPublicId,
    updatingReadPublicId,
    isSavingUrl: saveUrlArticle.isLoading,
    isSavingRaw: saveRawTextArticle.isLoading,
    articles,
    allArticlesCount: allArticles.length,
    readArticlesCount,
    unreadArticlesCount,
    isArticlesLoading: listQuery.isLoading,
    isArticlesRefreshing: listQuery.isFetching,
    listErrorMessage,
    onArticleUrlChange: setArticleUrl,
    onRawTitleChange: setRawTitle,
    onRawTextChange: setRawText,
    onReadFilterChange: setReadFilter,
    onDeleteArticle: handleDeleteArticle,
    onToggleReadState: handleToggleReadState,
    onSaveUrlSubmit: handleSaveUrlSubmit,
    onSaveRawTextSubmit: handleSaveRawTextSubmit,
    onRefreshArticles: () => listQuery.refetch(),
  };
}
