import type { Prisma } from "@/koala/generated/prisma/client";

export const articleHighlightActivitySelect = {
  id: true,
  selectedText: true,
  selectedOccurrenceIndex: true,
  occurrencesJson: true,
  createdAt: true,
  importedAt: true,
  article: { select: { title: true } },
} satisfies Prisma.ReaderArticleHighlightSelect;

export const bookHighlightActivitySelect = {
  id: true,
  quote: true,
  selectedOccurrenceIndex: true,
  occurrencesJson: true,
  chapterTitle: true,
  createdAt: true,
  importedAt: true,
  book: { select: { title: true } },
} satisfies Prisma.ReaderBookAnnotationSelect;
