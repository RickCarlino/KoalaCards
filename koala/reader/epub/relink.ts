import type { EpubManifest } from "./types";

export type RelinkableReaderBook = {
  publicId: string;
  fingerprint: string;
  title: string;
  author: string;
  opfIdentifier: string;
};

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasMatchingIdentifier(
  book: RelinkableReaderBook,
  manifest: EpubManifest,
): boolean {
  const bookIdentifier = normalizeMatchText(book.opfIdentifier);
  const manifestIdentifier = normalizeMatchText(manifest.opfIdentifier);
  if (!bookIdentifier || !manifestIdentifier) {
    return false;
  }

  return bookIdentifier === manifestIdentifier;
}

function hasMatchingTitleAndAuthor(
  book: RelinkableReaderBook,
  manifest: EpubManifest,
): boolean {
  const bookTitle = normalizeMatchText(book.title);
  const manifestTitle = normalizeMatchText(manifest.title);
  const bookAuthor = normalizeMatchText(book.author);
  const manifestAuthor = normalizeMatchText(manifest.author);
  if (!bookTitle || !manifestTitle || !bookAuthor || !manifestAuthor) {
    return false;
  }

  return bookTitle === manifestTitle && bookAuthor === manifestAuthor;
}

export function canRelinkReaderBook(options: {
  book: RelinkableReaderBook;
  manifest: EpubManifest;
}): boolean {
  if (options.book.fingerprint === options.manifest.fingerprint) {
    return true;
  }

  return (
    hasMatchingIdentifier(options.book, options.manifest) ||
    hasMatchingTitleAndAuthor(options.book, options.manifest)
  );
}

export function manifestForRelinkedReaderBook(options: {
  book: RelinkableReaderBook;
  manifest: EpubManifest;
}): EpubManifest {
  return {
    ...options.manifest,
    fingerprint: options.book.fingerprint,
  };
}
