import { prismaClient as db } from "../koala/prisma-client.ts";
import { ensureDeckFsrsConfig } from "../koala/fsrs/scheduler-server.ts";

export async function seedMcpStudy(userId: string, label: string) {
  const date = new Date("2026-10-10T12:00:00Z");
  const deck = await db.deck.create({
    data: { userId, name: `${label} deck` },
  });
  const card = await db.card.create({
    data: {
      userId,
      deckId: deck.id,
      term: `${label} 단어`,
      definition: `${label} meaning`,
      firstReview: date.getTime(),
      lastReview: date.getTime(),
      nextReview: date.getTime(),
      repetitions: 5,
      lapses: 2,
      stability: 4,
      difficulty: 3,
      reviewLogCoverage: "PARTIAL",
      reviewLogStartedAt: date,
    },
  });
  const quiz = await db.quizResult.create({
    data: {
      userId,
      acceptableTerm: card.term,
      definition: card.definition,
      userInput: `${label} wrong response`,
      reason: `${label} grading explanation`,
      isAcceptable: false,
      createdAt: date,
      helpfulness: -1,
    },
  });
  await db.quizResult.create({
    data: {
      userId,
      acceptableTerm: card.term,
      definition: card.definition,
      userInput: `${label} later response`,
      reason: "Accepted",
      isAcceptable: true,
      createdAt: new Date("2026-10-11T12:00:00Z"),
    },
  });
  const config = await ensureDeckFsrsConfig(db, {
    userId,
    deckId: deck.id,
  });
  const review = await db.cardReviewLog.create({
    data: {
      userId,
      deckId: deck.id,
      cardId: card.id,
      deckFsrsConfigId: config.id,
      reviewAt: date,
      rating: 1,
      completeness: "PARTIAL",
      rawLogJson: {},
      tsFsrsVersion: "5.4.0",
    },
  });
  const writing = await db.writingSubmission.create({
    data: {
      userId,
      deckId: deck.id,
      prompt: `${label} prompt`,
      submission: `${label} original`,
      correction: `${label} correction`,
      submissionCharacterCount: 14,
      correctionCharacterCount: 16,
      createdAt: date,
    },
  });
  const article = await db.readerArticle.create({
    data: {
      userId,
      title: `${label} article`,
      description: "Saved article",
      inputKind: "RAW",
      ingestStatus: "READY",
      contentText:
        "가".repeat(14000) + `${label} needle` + "나".repeat(14000),
      contentHtml: "",
      createdAt: date,
    },
  });
  const common = {
    userId,
    selectedTextHash: "hash",
    selectedOccurrenceIndex: 0,
    occurrenceCount: 1,
    occurrencesJson: [{ before: "before", match: "표현", after: "after" }],
    status: "READY" as const,
    generalMeaning: `${label} general meaning`,
    meaningInContext: `${label} contextual meaning`,
    createdAt: date,
  };
  const highlight = await db.readerArticleHighlight.create({
    data: {
      ...common,
      articleId: article.id,
      selectedText: "표현",
      articleContentHash: "article-hash",
      term: `${label} article expression`,
      definition: "An article expression",
    },
  });
  const book = await db.readerBook.create({
    data: {
      userId,
      title: `${label} book`,
      author: "Author",
      fingerprint: "test-book",
      fileName: "PRIVATE-LOCAL.epub",
      fileSize: 100,
      fileLastModified: 0,
      navigationJson: [],
      spineJson: [],
      progress: {
        create: {
          userId,
          lastLocatorJson: { href: "ch1.xhtml", totalProgression: 0.3 },
          furthestLocatorJson: {
            href: "ch1.xhtml",
            totalProgression: 0.4,
          },
        },
      },
    },
  });
  const annotation = await db.readerBookAnnotation.create({
    data: {
      ...common,
      bookId: book.id,
      quote: `${label} book quote`,
      locatorJson: { href: "ch1.xhtml" },
      sectionTextHash: "section-hash",
      term: `${label} book expression`,
      definition: "A book expression",
      contextBefore: "Before",
      contextAfter: "After",
      chapterTitle: "Chapter one",
      progression: 0.3,
    },
  });
  const link = await db.languageExchangeLink.create({
    data: { userId, slug: userId },
  });
  const call = await db.languageExchangeCall.create({
    data: {
      learnerId: userId,
      linkId: link.id,
      guestToken: userId,
      offerSdp: { secret: "PRIVATE-SIGNALING" },
      answerSdp: { secret: "PRIVATE-SIGNALING" },
      status: "ENDED",
      createdAt: date,
      expiresAt: date,
      acceptedAt: date,
      endedAt: new Date(date.getTime() + 60000),
    },
  });
  return {
    deck,
    card,
    quiz,
    review,
    writing,
    article,
    highlight,
    book,
    annotation,
    call,
  };
}

export function studyRecordKeys(
  seed: Awaited<ReturnType<typeof seedMcpStudy>>,
) {
  return {
    deck: seed.deck.id,
    card: seed.card.id,
    quiz_result: seed.quiz.id,
    review: seed.review.id,
    writing: seed.writing.id,
    article: seed.article.id,
    book: seed.book.id,
    article_highlight: seed.highlight.id,
    book_highlight: seed.annotation.id,
    call: seed.call.id,
  };
}
