import {
  buildHighlightSnippet,
  normalizeHighlightText,
} from "./highlight-snippet";

export type ReaderActivityKind = "article" | "book";

export type ReaderActivityRow = {
  key: string;
  kind: ReaderActivityKind;
  sourceTitle: string;
  selectedText: string;
  context: string;
  chapterTitle: string;
  createdAt: Date;
  importedAt: Date | null;
};

type ArticleHighlightActivityInput = {
  id: number;
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrencesJson: unknown;
  createdAt: Date;
  importedAt: Date | null;
  article: { title: string };
};

type BookHighlightActivityInput = {
  id: number;
  quote: string;
  selectedOccurrenceIndex: number;
  occurrencesJson: unknown;
  chapterTitle: string;
  createdAt: Date;
  importedAt: Date | null;
  book: { title: string };
};

function highlightContext(options: {
  selectedText: string;
  selectedOccurrenceIndex: number;
  occurrencesJson: unknown;
}): string {
  return (
    buildHighlightSnippet({
      selectedText: normalizeHighlightText(options.selectedText),
      selectedOccurrenceIndex: options.selectedOccurrenceIndex,
      occurrencesJson: options.occurrencesJson,
    })?.snippet ?? ""
  );
}

export function combineReaderHighlightActivity(options: {
  articles: ArticleHighlightActivityInput[];
  books: BookHighlightActivityInput[];
  limit: number;
}): ReaderActivityRow[] {
  const articles = options.articles.map((highlight) => ({
    key: `article-${highlight.id}`,
    kind: "article" as const,
    sourceTitle: highlight.article.title,
    selectedText: highlight.selectedText,
    context: highlightContext(highlight),
    chapterTitle: "",
    createdAt: highlight.createdAt,
    importedAt: highlight.importedAt,
  }));
  const books = options.books.map((highlight) => ({
    key: `book-${highlight.id}`,
    kind: "book" as const,
    sourceTitle: highlight.book.title,
    selectedText: highlight.quote,
    context: highlightContext({
      selectedText: highlight.quote,
      selectedOccurrenceIndex: highlight.selectedOccurrenceIndex,
      occurrencesJson: highlight.occurrencesJson,
    }),
    chapterTitle: highlight.chapterTitle,
    createdAt: highlight.createdAt,
    importedAt: highlight.importedAt,
  }));

  return [...articles, ...books]
    .filter((highlight) => highlight.context.length > 0)
    .sort((left, right) => {
      return right.createdAt.getTime() - left.createdAt.getTime();
    })
    .slice(0, Math.max(0, options.limit));
}

export function combineReaderHighlightDates(options: {
  articles: Date[];
  books: Date[];
}): Date[] {
  return [...options.articles, ...options.books].sort((left, right) => {
    return left.getTime() - right.getTime();
  });
}

export function combineReaderCounts(options: {
  articleCount: number;
  bookCount: number;
  articleHighlightCount: number;
  bookHighlightCount: number;
  importedArticleHighlightCount: number;
  importedBookHighlightCount: number;
}) {
  return {
    documentCount: options.articleCount + options.bookCount,
    highlightCount:
      options.articleHighlightCount + options.bookHighlightCount,
    importedHighlightCount:
      options.importedArticleHighlightCount +
      options.importedBookHighlightCount,
  };
}
