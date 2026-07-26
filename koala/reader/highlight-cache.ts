import type { ReaderResourceKind } from "./contracts";

export function shouldLoadReaderHighlightCache(options: {
  kind: ReaderResourceKind;
  retry: boolean;
}): boolean {
  return !options.retry;
}
