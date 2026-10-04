import test from "node:test";
import assert from "node:assert/strict";
import { Rating, State } from "ts-fsrs";
import {
  fetchArticleSnapshot,
  isPrivateOrLocalIp,
  normalizeSourceUrl,
  plainTextToHtmlParagraphs,
} from "../koala/reader/article.ts";
import {
  buildOccurrenceContexts,
  findOccurrenceOffsets,
  selectOccurrenceIndex,
  takePromptOccurrences,
} from "../koala/reader/highlight-context.ts";
import {
  calculateSchedulingData,
  getGradeButtonText,
  toFsrsCardInput,
} from "../koala/trpc-routes/calculate-scheduling-data.ts";
import {
  buildSpeechInput,
  resolveSpeechContentType,
  resolveSpeechFormat,
} from "../koala/api/speech-helpers.ts";
import {
  buildKoreanTranscriptionPrompt,
  buildTranscriptionPrompt,
  buildTranscriptionRequest,
  firstParam,
  getAudioFilename,
  hasValidAudioContentLength,
  resolveContentType,
} from "../koala/api/transcribe-helpers.ts";

test("isPrivateOrLocalIp identifies private and public addresses", () => {
  assert.equal(isPrivateOrLocalIp("127.0.0.1"), true);
  assert.equal(isPrivateOrLocalIp("10.0.0.1"), true);
  assert.equal(isPrivateOrLocalIp("172.20.0.1"), true);
  assert.equal(isPrivateOrLocalIp("100.64.0.1"), true);
  assert.equal(isPrivateOrLocalIp("169.254.10.20"), true);
  assert.equal(isPrivateOrLocalIp("::1"), true);
  assert.equal(isPrivateOrLocalIp("fd00::1"), true);
  assert.equal(isPrivateOrLocalIp("fe80::1"), true);
  assert.equal(isPrivateOrLocalIp("::ffff:8.8.8.8"), false);
  assert.equal(isPrivateOrLocalIp("::ffff:192.168.0.1"), true);
  assert.equal(isPrivateOrLocalIp("8.8.8.8"), false);
  assert.equal(isPrivateOrLocalIp("not an ip"), true);
});

test("article helpers normalize source URLs and escape plain text", () => {
  assert.equal(
    normalizeSourceUrl("https://example.com/read?a=1#section"),
    "https://example.com/read?a=1",
  );
  assert.throws(
    () => normalizeSourceUrl("ftp://example.com/file"),
    /Only http and https/,
  );
  assert.equal(
    plainTextToHtmlParagraphs(' First <line>\n\nSecond & "quoted" '),
    "<p>First &lt;line&gt;</p>\n<p>Second &amp; &quot;quoted&quot;</p>",
  );
});

test("fetchArticleSnapshot extracts readable article metadata and text", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    assert.equal(input, "https://93.184.216.34/story");
    assert.equal(init?.method, "GET");
    assert.equal(
      (init?.headers as Record<string, string>)["User-Agent"],
      "KoalaCards/1.0",
    );
    return new Response(
      `<!doctype html>
      <html>
        <head>
          <meta property="og:title" content="A &amp; B">
          <meta name="description" content="Short &lt;summary&gt;">
          <title>Fallback title</title>
        </head>
        <body>
          <script>ignored()</script>
          <h1>Heading</h1>
          <p>First&nbsp;paragraph<br>continued.</p>
          <p>Second &amp; final.</p>
        </body>
      </html>`,
      { status: 200 },
    );
  };

  try {
    const snapshot = await fetchArticleSnapshot(
      "https://93.184.216.34/story#ignored",
    );

    assert.equal(snapshot.normalizedUrl, "https://93.184.216.34/story");
    assert.equal(snapshot.title, "A & B");
    assert.equal(snapshot.description, "Short <summary>");
    assert.match(snapshot.text, /Heading/);
    assert.match(snapshot.text, /First paragraph/);
    assert.match(snapshot.text, /Second & final\./);
    assert.doesNotMatch(snapshot.htmlContent, /script/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchArticleSnapshot reports unsafe and unreadable fetches", async () => {
  await assert.rejects(
    () => fetchArticleSnapshot("https://localhost/story"),
    /Local URLs are not supported/,
  );
  await assert.rejects(
    () => fetchArticleSnapshot("https://192.168.0.1/story"),
    /Private network URLs are not supported/,
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("   ", { status: 200 });

  try {
    await assert.rejects(
      () => fetchArticleSnapshot("https://93.184.216.34/empty"),
      /Fetched article was empty/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("selectOccurrenceIndex prefers the best contextual match", () => {
  const occurrences = [
    {
      index: 0,
      startOffset: 0,
      endOffset: 4,
      before: "prefix",
      match: "word",
      after: "other",
    },
    {
      index: 1,
      startOffset: 10,
      endOffset: 14,
      before: "best prefix",
      match: "word",
      after: "best suffix",
    },
  ];

  assert.equal(
    selectOccurrenceIndex({
      occurrences,
      contextBefore: "best prefix",
      contextAfter: "best suffix",
      occurrenceHint: 0,
    }),
    1,
  );
});

test("selectOccurrenceIndex falls back to a valid hint when scores tie at zero", () => {
  const occurrences = [
    {
      index: 0,
      startOffset: 0,
      endOffset: 4,
      before: "alpha",
      match: "word",
      after: "beta",
    },
    {
      index: 1,
      startOffset: 10,
      endOffset: 14,
      before: "gamma",
      match: "word",
      after: "delta",
    },
  ];

  assert.equal(
    selectOccurrenceIndex({
      occurrences,
      contextBefore: "",
      contextAfter: "",
      occurrenceHint: 1,
    }),
    1,
  );
});

test("highlight occurrence helpers find exact, overlapping, and flexible matches", () => {
  assert.deepEqual(findOccurrenceOffsets("aaaa", "aa"), [
    { startOffset: 0, endOffset: 2 },
    { startOffset: 1, endOffset: 3 },
    { startOffset: 2, endOffset: 4 },
  ]);
  assert.deepEqual(
    findOccurrenceOffsets("alpha \n beta alpha", "alpha beta"),
    [{ startOffset: 0, endOffset: 12 }],
  );
  assert.deepEqual(findOccurrenceOffsets("x a+b \n c?d y", "a+b c?d"), [
    { startOffset: 2, endOffset: 11 },
  ]);
  assert.deepEqual(findOccurrenceOffsets("alpha beta", ""), []);

  assert.deepEqual(buildOccurrenceContexts("one two one", "one", 2), [
    {
      index: 0,
      startOffset: 0,
      endOffset: 3,
      before: "",
      match: "one",
      after: " t",
    },
    {
      index: 1,
      startOffset: 8,
      endOffset: 11,
      before: "o ",
      match: "one",
      after: "",
    },
  ]);
});

test("takePromptOccurrences keeps nearby occurrences around the selected match", () => {
  const occurrences = buildOccurrenceContexts(
    "word a word b word c word d word",
    "word",
    1,
  );

  assert.deepEqual(
    takePromptOccurrences({
      occurrences,
      selectedIndex: 3,
      maxOccurrences: 3,
    }).map((occurrence) => occurrence.index),
    [2, 3, 4],
  );
  assert.deepEqual(
    takePromptOccurrences({
      occurrences,
      selectedIndex: 99,
      maxOccurrences: 2,
    }).map((occurrence) => occurrence.index),
    [0, 1],
  );
});

test("toFsrsCardInput normalizes review stats and derives review state", () => {
  const now = Date.now();
  const lastReview = now - 2 * 24 * 60 * 60 * 1000;
  const nextReview = now + 24 * 60 * 60 * 1000;

  const card = toFsrsCardInput(
    {
      difficulty: 5,
      stability: 8,
      lastReview,
      nextReview,
      lapses: -2,
      repetitions: 3.7,
    },
    now,
  );

  assert.equal(card.state, State.Review);
  assert.equal(card.lapses, 0);
  assert.equal(card.reps, 3);
  assert.equal(card.due, nextReview);
  assert.equal(card.last_review, lastReview);
  assert.ok(card.elapsed_days > 1.9);
  assert.ok(card.scheduled_days > 0.9);
});

test("scheduling helpers handle new and reviewed cards", () => {
  const now = Date.UTC(2025, 0, 1);
  const newCard = {
    difficulty: 0,
    stability: 0,
    lastReview: 0,
    lapses: 0,
    repetitions: 0,
  };

  const scheduledNewCard = calculateSchedulingData(
    newCard,
    Rating.Again,
    now,
    0.8,
  );
  assert.ok(scheduledNewCard.nextReview >= now);
  assert.ok(scheduledNewCard.difficulty > 0);
  assert.ok(scheduledNewCard.stability > 0);

  const reviewedCard = calculateSchedulingData(
    {
      difficulty: 5,
      stability: 8,
      lastReview: now - 3 * 24 * 60 * 60 * 1000,
      nextReview: now,
      lapses: 1,
      repetitions: 4,
    },
    Rating.Good,
    now,
  );
  assert.ok(reviewedCard.nextReview >= now);

  const labels = getGradeButtonText(newCard, 0.8);
  assert.equal(labels.length, 4);
  assert.deepEqual(
    labels.map(([grade]) => grade),
    [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy],
  );
  assert.ok(labels.every(([, label]) => label.length > 1));
});

test("speech helpers compose input and resolve formats", () => {
  assert.equal(
    buildSpeechInput(" 안녕하세요 ", " Hello "),
    "안녕하세요\nHello",
  );
  assert.equal(buildSpeechInput(" 안녕하세요 ", " "), "안녕하세요");
  assert.equal(buildSpeechInput("   ", "Hello"), null);
  assert.equal(resolveSpeechFormat(undefined), "mp3");
  assert.equal(resolveSpeechContentType("opus"), "audio/ogg");
});

test("transcribe helpers normalize headers and preserve hint prompt text", () => {
  assert.equal(firstParam(["a", "b"]), "a");
  assert.equal(resolveContentType(undefined), "application/octet-stream");
  assert.equal(hasValidAudioContentLength(10, 20), true);
  assert.equal(hasValidAudioContentLength(30, 20), false);
  assert.equal(getAudioFilename("audio/mp4"), "recording.mp4");
  assert.equal(getAudioFilename("audio/webm"), "recording.webm");
  assert.equal(buildTranscriptionPrompt(""), null);
  assert.equal(
    buildTranscriptionPrompt("단어, 예문"),
    "Might contain words like 단어, 예문",
  );
  assert.equal(
    buildKoreanTranscriptionPrompt(null),
    "한국어 음성을 한글로 받아쓰세요. 로마자나 일본어 문자로 바꾸지 마세요.",
  );
  assert.equal(
    buildKoreanTranscriptionPrompt(
      buildTranscriptionPrompt("단어"),
    ).includes("Might contain words like 단어"),
    true,
  );
  assert.deepEqual(
    buildTranscriptionRequest({
      file: "blob",
      language: "ko",
      prompt: buildKoreanTranscriptionPrompt(
        buildTranscriptionPrompt("단어"),
      ),
    }),
    {
      file: "blob",
      model: "gpt-4o-transcribe",
      language: "ko",
      response_format: "json",
      prompt:
        "한국어 음성을 한글로 받아쓰세요. 로마자나 일본어 문자로 바꾸지 마세요.\nMight contain words like 단어",
    },
  );
});
