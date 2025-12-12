import { GradingResult } from "@/koala/review/types";

export const ASSISTANT_PANEL_WIDTH = 380;

const TERM_THEN_DEFINITION_ITEM_TYPES = new Set([
  "remedialIntro",
  "newWordIntro",
]);

const DEFINITION_AUDIO_ITEM_TYPES = new Set([
  "speaking",
  "newWordOutro",
  "remedialOutro",
]);

type ReviewItemType =
  | "remedialIntro"
  | "newWordIntro"
  | "speaking"
  | "newWordOutro"
  | "remedialOutro"
  | string;

type ReviewCard = {
  cardId: number;
  term: string;
  definition: string;
  uuid: string;
  definitionAudio?: string | null;
};

type ReviewItem = {
  itemType: ReviewItemType;
  stepUuid: string;
  cardUUID: string;
};

export function isAudioAutoPlayItemType(itemType: ReviewItemType) {
  return TERM_THEN_DEFINITION_ITEM_TYPES.has(itemType);
}

export function isDefinitionAudioItemType(itemType: ReviewItemType) {
  return DEFINITION_AUDIO_ITEM_TYPES.has(itemType);
}

export function getHeaderHeight(params: {
  isDesktop: boolean;
  isLargeDesktop: boolean;
}) {
  if (params.isLargeDesktop) {
    return 80;
  }
  if (params.isDesktop) {
    return 70;
  }
  return 60;
}

export function getContentHeight(params: {
  isDesktop: boolean;
  headerHeight: number;
}) {
  if (!params.isDesktop) {
    return "100vh";
  }
  return `calc(100vh - ${params.headerHeight}px)`;
}

export function getGridTemplateColumns(params: {
  showDesktopAssistant: boolean;
}) {
  if (!params.showDesktopAssistant) {
    return "1fr";
  }
  return `1fr ${ASSISTANT_PANEL_WIDTH}px`;
}

export function buildAssistantCardContext(card: ReviewCard | undefined) {
  if (!card) {
    return undefined;
  }
  return {
    cardId: card.cardId,
    term: card.term,
    definition: card.definition,
    uuid: card.uuid,
  };
}

export function buildCardShownEvent(card: ReviewCard, item: ReviewItem) {
  return `CardID: ${card.cardId}; Term: ${card.term}; Definition: ${card.definition}; Step: ${item.itemType}`;
}

export function buildSimpleCardEvent(card: ReviewCard) {
  return `Card: ${card.term}; Definition: ${card.definition}`;
}

export function buildGradingResultEvent(
  card: ReviewCard,
  result: GradingResult,
) {
  const outcome = result.isCorrect ? "correct" : "incorrect";
  const userSaid = result.transcription
    ? `User said: ${result.transcription}.`
    : "";
  const feedback = result.feedback ? `Feedback: ${result.feedback}.` : "";
  const message =
    `Card: ${card.term}; Outcome: ${outcome}. ${userSaid} ${feedback}`.trim();
  return message.length ? message : null;
}

export function buildCardEditedEvent(params: {
  cards: Record<string, ReviewCard>;
  cardId: number;
  updates: { term: string; definition: string };
}) {
  const matchingCard = Object.values(params.cards).find(
    (item) => item.cardId === params.cardId,
  );
  if (!matchingCard) {
    return null;
  }

  const termForLog = params.updates.term;
  const definitionForLog = params.updates.definition;
  if (!termForLog && !definitionForLog) {
    return null;
  }

  const termLabel = termForLog || "(unchanged)";
  const definitionLabel = definitionForLog || "(unchanged)";

  return `CardID ${params.cardId}; Term: ${termLabel}; Definition: ${definitionLabel}`;
}

export function isRecordDisabled(params: {
  gradingResults: Record<string, { isCorrect?: boolean } | undefined>;
  cardUUID: string;
}) {
  return Boolean(params.gradingResults[params.cardUUID]?.isCorrect);
}
