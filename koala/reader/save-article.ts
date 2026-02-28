import { ReaderSaveOrigin, ReaderSourceLanguage } from "@prisma/client";
import { prismaClient } from "@/koala/prisma-client";
import {
  fetchArticleSnapshot,
  plainTextToHtmlParagraphs,
} from "@/koala/reader/article";
import {
  detectSourceLanguage,
  translateEnglishToKorean,
} from "@/koala/reader/language";

export type ReaderLanguage = "ko" | "en" | "other";
export type ReaderSaveOriginValue = "DASHBOARD" | "BOOKMARKLET";
export type ReaderRouteErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR";

export class ReaderSaveError extends Error {
  code: ReaderRouteErrorCode;
  status: number;

  constructor(
    message: string,
    code: ReaderRouteErrorCode,
    status: number,
  ) {
    super(message);
    this.name = "ReaderSaveError";
    this.code = code;
    this.status = status;
  }
}

export type SavedReaderArticle = {
  id: number;
  publicId: string;
  title: string;
  normalizedUrl: string;
  description: string;
  sourceLang: ReaderLanguage;
  translated: boolean;
  createdAt: Date;
};

type SaveReaderArticleInput = {
  userId: string;
  requestUrl: string;
  saveOrigin: ReaderSaveOriginValue;
  suggestedTitle?: string;
};

const toReaderSourceLanguage = (
  value: ReaderLanguage,
): ReaderSourceLanguage => {
  if (value === "ko") {
    return "KO";
  }

  if (value === "en") {
    return "EN";
  }

  return "OTHER";
};

const fromReaderSourceLanguage = (
  value: ReaderSourceLanguage,
): ReaderLanguage => {
  if (value === "KO") {
    return "ko";
  }

  if (value === "EN") {
    return "en";
  }

  return "other";
};

const normalizeSuggestedTitle = (title?: string): string => {
  if (!title) {
    return "";
  }

  return title.trim().slice(0, 400);
};

const chooseSavedTitle = (
  extractedTitle: string,
  suggestedTitle?: string,
): string => {
  const normalizedSuggestion = normalizeSuggestedTitle(suggestedTitle);

  if (!extractedTitle.trim()) {
    return normalizedSuggestion || "Untitled article";
  }

  if (
    extractedTitle.trim().toLowerCase() === "untitled article" &&
    normalizedSuggestion
  ) {
    return normalizedSuggestion;
  }

  return extractedTitle.trim();
};

export const saveReaderArticle = async (
  input: SaveReaderArticleInput,
): Promise<SavedReaderArticle> => {
  const requestUrl = input.requestUrl.trim();
  if (!requestUrl) {
    throw new ReaderSaveError(
      "Please provide an article URL.",
      "BAD_REQUEST",
      400,
    );
  }

  let snapshot;
  try {
    snapshot = await fetchArticleSnapshot(requestUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not fetch article.";
    throw new ReaderSaveError(message, "BAD_REQUEST", 400);
  }

  const sourceLanguage = await detectSourceLanguage(
    [snapshot.title, snapshot.description, snapshot.text]
      .filter((part) => part.trim().length > 0)
      .join("\n\n"),
  );

  if (sourceLanguage === "other") {
    throw new ReaderSaveError(
      "Only English or Korean articles are supported right now.",
      "BAD_REQUEST",
      400,
    );
  }

  let translated = false;
  let koreanText = snapshot.text;

  if (sourceLanguage === "en") {
    try {
      koreanText = await translateEnglishToKorean(snapshot.text);
      translated = true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not translate this article.";
      throw new ReaderSaveError(message, "INTERNAL_SERVER_ERROR", 500);
    }
  }

  const saveOrigin: ReaderSaveOrigin = input.saveOrigin;
  const saved = await prismaClient.readerArticle.create({
    data: {
      userId: input.userId,
      requestUrl,
      normalizedUrl: snapshot.normalizedUrl,
      title: chooseSavedTitle(snapshot.title, input.suggestedTitle),
      description: snapshot.description,
      sourceLang: toReaderSourceLanguage(sourceLanguage),
      translated,
      saveOrigin,
      contentText: koreanText,
      contentHtml: plainTextToHtmlParagraphs(koreanText),
    },
    select: {
      id: true,
      publicId: true,
      title: true,
      normalizedUrl: true,
      description: true,
      sourceLang: true,
      translated: true,
      createdAt: true,
    },
  });

  return {
    id: saved.id,
    publicId: saved.publicId,
    title: saved.title,
    normalizedUrl: saved.normalizedUrl,
    description: saved.description,
    sourceLang: fromReaderSourceLanguage(saved.sourceLang),
    translated: saved.translated,
    createdAt: saved.createdAt,
  };
};
