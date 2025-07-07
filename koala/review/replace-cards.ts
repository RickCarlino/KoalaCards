import { uid } from "radash";
import { ReplaceCardAction, State, QuizMap } from "./types";
import { nextQueueItem } from "./reducer";
export function replaceCards(
  action: ReplaceCardAction,
  state: State,
): State {
  const cards = action.payload.reduce((acc: QuizMap, item) => {
    return { ...acc, [item.uuid]: item };
  }, {} as QuizMap);

  // Start with a fresh state
  const freshState: State = {
    ...state,
    queue: {
      newWordIntro: [],
      remedialIntro: [],
      listening: [],
      speaking: [],
      newWordOutro: [],
      remedialOutro: [],
    },
  };

  const nextState = action.payload.reduce((acc, item): State => {
    switch (item.lessonType) {
      case "new":
        return {
          ...acc,
          queue: {
            ...acc.queue,
            newWordIntro: [
              ...acc.queue.newWordIntro,
              {
                cardUUID: item.uuid,
                itemType: "newWordIntro" as const,
                stepUuid: uid(8),
              },
            ],
            newWordOutro: [
              ...acc.queue.newWordOutro,
              {
                cardUUID: item.uuid,
                itemType: "newWordOutro" as const,
                stepUuid: uid(8),
              },
            ],
          },
        };
      case "listening":
        return {
          ...acc,
          queue: {
            ...acc.queue,
            listening: [
              ...acc.queue.listening,
              {
                cardUUID: item.uuid,
                itemType: "listening" as const,
                stepUuid: uid(8),
              },
            ],
          },
        };
      case "speaking":
        return {
          ...acc,
          queue: {
            ...acc.queue,
            speaking: [
              ...acc.queue.speaking,
              {
                cardUUID: item.uuid,
                itemType: "speaking" as const,
                stepUuid: uid(8),
              },
            ],
          },
        };
      case "remedial":
        return {
          ...acc,
          queue: {
            ...acc.queue,
            remedialIntro: [
              ...acc.queue.remedialIntro,
              {
                cardUUID: item.uuid,
                itemType: "remedialIntro" as const,
                stepUuid: uid(8),
              },
            ],
            remedialOutro: [
              ...acc.queue.remedialOutro,
              {
                cardUUID: item.uuid,
                itemType: "remedialOutro" as const,
                stepUuid: uid(8),
              },
            ],
          },
        };
      default:
        throw new Error(`Unknown lesson type: ${item.lessonType}`);
    }
  }, freshState);
  return {
    ...nextState,
    cards,
    currentItem: nextQueueItem(nextState.queue),
    recordings: {}, // Clear recordings to prevent memory leak
    gradingResults: {}, // Clear grading results to prevent memory leak
  };
}
