import type { ReaderBookLocator } from "./book";
import type { EpubSpineItem } from "./epub/types";

export function normalizeReaderBookHref(value: string): string {
  return value.split("#")[0].replace(/^\/+/, "");
}

export function findReaderBookSectionIndex(
  spine: EpubSpineItem[],
  locator: Pick<ReaderBookLocator, "href"> | null | undefined,
): number {
  if (!locator?.href) {
    return 0;
  }
  const normalized = normalizeReaderBookHref(locator.href);
  const index = spine.findIndex((item) => {
    return normalizeReaderBookHref(item.href) === normalized;
  });
  return index < 0 ? 0 : index;
}
