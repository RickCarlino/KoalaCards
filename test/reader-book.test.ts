import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseFurthestReaderBookLocator,
  clampReaderProgression,
  locatorProgression,
  normalizeReaderBookProgression,
} from "../koala/reader/book.ts";
import {
  canRelinkReaderBook,
  manifestForRelinkedReaderBook,
} from "../koala/reader/epub/relink.ts";
import type { EpubManifest } from "../koala/reader/epub/types.ts";

function testManifest(overrides: Partial<EpubManifest>): EpubManifest {
  return {
    fingerprint: "epub|manifest|1|100|200",
    title: "The Book",
    author: "The Author",
    description: "",
    language: "en",
    opfIdentifier: "urn:isbn:123",
    fileName: "book.epub",
    fileSize: 100,
    fileLastModified: 200,
    coverPath: "",
    navigationJson: [],
    spineJson: [
      {
        id: "chapter",
        href: "chapter.xhtml",
        mediaType: "application/xhtml+xml",
      },
    ],
    ...overrides,
  };
}

test("reader book helpers clamp and normalize progression", () => {
  assert.equal(clampReaderProgression(-1), 0);
  assert.equal(clampReaderProgression(2), 1);
  assert.equal(clampReaderProgression(Number.NaN), 0);
  assert.equal(normalizeReaderBookProgression(0.12345678), 0.123457);
});

test("reader book helpers prefer total progression for locators", () => {
  assert.equal(
    locatorProgression({
      href: "chapter.xhtml",
      progression: 0.8,
      totalProgression: 0.4,
    }),
    0.4,
  );
  assert.equal(locatorProgression(null), 0);
});

test("reader book helpers keep furthest progress separate from last location", () => {
  const existing = {
    href: "chapter-4.xhtml",
    totalProgression: 0.7,
  };
  const earlierCandidate = {
    href: "chapter-2.xhtml",
    totalProgression: 0.3,
  };
  const laterCandidate = {
    href: "chapter-5.xhtml",
    totalProgression: 0.9,
  };

  assert.equal(
    chooseFurthestReaderBookLocator({
      existing,
      candidate: earlierCandidate,
    }),
    existing,
  );
  assert.equal(
    chooseFurthestReaderBookLocator({
      existing,
      candidate: laterCandidate,
    }),
    laterCandidate,
  );
});

test("reader book relink accepts matching identifiers and metadata", () => {
  const book = {
    publicId: "book_public_id",
    fingerprint: "epub|server|1|100|100",
    title: "The Book",
    author: "The Author",
    opfIdentifier: "urn:isbn:123",
  };

  assert.equal(
    canRelinkReaderBook({
      book,
      manifest: testManifest({ fingerprint: book.fingerprint }),
    }),
    true,
  );
  assert.equal(
    canRelinkReaderBook({
      book,
      manifest: testManifest({ fingerprint: "different" }),
    }),
    true,
  );
  assert.equal(
    canRelinkReaderBook({
      book: { ...book, opfIdentifier: "" },
      manifest: testManifest({
        fingerprint: "different",
        opfIdentifier: "",
      }),
    }),
    true,
  );
  assert.equal(
    canRelinkReaderBook({
      book,
      manifest: testManifest({
        fingerprint: "different",
        title: "Another Book",
        opfIdentifier: "urn:isbn:999",
      }),
    }),
    false,
  );
});

test("reader book relink keeps the server fingerprint for local handles", () => {
  const book = {
    publicId: "book_public_id",
    fingerprint: "epub|server|1|100|100",
    title: "The Book",
    author: "The Author",
    opfIdentifier: "urn:isbn:123",
  };
  const manifest = testManifest({ fingerprint: "epub|local|1|100|300" });

  assert.equal(
    manifestForRelinkedReaderBook({ book, manifest }).fingerprint,
    book.fingerprint,
  );
});
