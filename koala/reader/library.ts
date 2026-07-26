import type { ReaderLibraryItem } from "./contracts";

export type ReaderDocumentFilter = "all" | "url" | "text" | "epub";

export type ReaderDocumentFilterCounts = Record<
  ReaderDocumentFilter,
  number
>;

export function readerDocumentSource(
  item: ReaderLibraryItem,
): Exclude<ReaderDocumentFilter, "all"> {
  if (item.kind === "book") {
    return "epub";
  }

  return item.sourceKind;
}

export function readerDocumentFilterCounts(
  items: ReaderLibraryItem[],
): ReaderDocumentFilterCounts {
  const counts: ReaderDocumentFilterCounts = {
    all: items.length,
    url: 0,
    text: 0,
    epub: 0,
  };

  for (const item of items) {
    counts[readerDocumentSource(item)] += 1;
  }

  return counts;
}

export function filterAndSortReaderDocuments(options: {
  items: ReaderLibraryItem[];
  filter: ReaderDocumentFilter;
}): ReaderLibraryItem[] {
  return [...options.items]
    .filter((item) => {
      return (
        options.filter === "all" ||
        readerDocumentSource(item) === options.filter
      );
    })
    .sort((left, right) => {
      const updatedDifference =
        right.updatedAt.getTime() - left.updatedAt.getTime();
      if (updatedDifference !== 0) {
        return updatedDifference;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });
}
