import type { Prisma } from "@/koala/generated/prisma/client";

export const deckSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  fsrsConfig: {
    select: {
      requestedRetention: true,
      parametersSource: true,
      lastOptimizedAt: true,
    },
  },
} satisfies Prisma.DeckSelect;

export const cardSelect = {
  id: true,
  term: true,
  definition: true,
  deckId: true,
  paused: true,
  createdAt: true,
  stability: true,
  difficulty: true,
  firstReview: true,
  lastReview: true,
  nextReview: true,
  lastFailure: true,
  lapses: true,
  repetitions: true,
  reviewLogCoverage: true,
  reviewLogStartedAt: true,
  lastPassiveReviewAt: true,
  Deck: { select: { name: true } },
} satisfies Prisma.CardSelect;

export const quizSelect = {
  id: true,
  createdAt: true,
  definition: true,
  acceptableTerm: true,
  userInput: true,
  isAcceptable: true,
  grade: true,
  reason: true,
  eventType: true,
  helpfulness: true,
  reviewedAt: true,
  errorTag: true,
  gradingSource: true,
  jevGrade: true,
  jevConfidence: true,
} satisfies Prisma.QuizResultSelect;

export const reviewSelect = {
  id: true,
  cardId: true,
  deckId: true,
  reviewAt: true,
  rating: true,
  completeness: true,
  dueAt: true,
  scheduledDays: true,
  elapsedDays: true,
  stabilityBefore: true,
  stabilityAfter: true,
  difficultyBefore: true,
  difficultyAfter: true,
  tsFsrsVersion: true,
} satisfies Prisma.CardReviewLogSelect;

export const writingSelect = {
  id: true,
  deckId: true,
  prompt: true,
  submission: true,
  correction: true,
  submissionCharacterCount: true,
  correctionCharacterCount: true,
  createdAt: true,
} satisfies Prisma.WritingSubmissionSelect;

export const articleSelect = {
  id: true,
  publicId: true,
  title: true,
  description: true,
  normalizedUrl: true,
  inputKind: true,
  ingestStatus: true,
  ingestedAt: true,
  readAt: true,
  lastReadAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReaderArticleSelect;

export const bookSelect = {
  id: true,
  publicId: true,
  title: true,
  author: true,
  description: true,
  language: true,
  createdAt: true,
  updatedAt: true,
  progress: {
    select: {
      lastLocatorJson: true,
      furthestLocatorJson: true,
      lastOpenedAt: true,
    },
  },
} satisfies Prisma.ReaderBookSelect;

const highlightFields = {
  id: true,
  selectedOccurrenceIndex: true,
  occurrenceCount: true,
  status: true,
  term: true,
  definition: true,
  generalMeaning: true,
  meaningInContext: true,
  importedCardId: true,
  importedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const articleHighlightSelect = {
  ...highlightFields,
  selectedText: true,
  occurrencesJson: true,
  article: { select: { id: true, publicId: true, title: true } },
} satisfies Prisma.ReaderArticleHighlightSelect;

export const bookHighlightSelect = {
  ...highlightFields,
  quote: true,
  contextBefore: true,
  contextAfter: true,
  locatorJson: true,
  chapterTitle: true,
  progression: true,
  book: { select: { id: true, publicId: true, title: true } },
} satisfies Prisma.ReaderBookAnnotationSelect;

export const callSelect = {
  id: true,
  status: true,
  createdAt: true,
  acceptedAt: true,
  endedAt: true,
} satisfies Prisma.LanguageExchangeCallSelect;

export const settingsSelect = {
  playbackSpeed: true,
  cardsPerDayMax: true,
  reviewTakeCount: true,
  requestedRetention: true,
  playbackPercentage: true,
  responseTimeoutSeconds: true,
  dailyWritingGoal: true,
  writingFirst: true,
  maxLapses: true,
  dueCardsEmailNotifications: true,
  languageExchangeAvailable: true,
  readerFontSize: true,
  readerLineHeight: true,
  readerReadingWidth: true,
} satisfies Prisma.UserSettingsSelect;
