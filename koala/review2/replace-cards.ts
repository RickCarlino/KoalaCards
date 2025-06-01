import { ReplaceCardAction, State, QuizMap } from "./types";

export function replaceCards(
  action: ReplaceCardAction,
  state: State,
): State {
  const cards = action.payload.reduce((acc: QuizMap, item) => {
    return { ...acc, [item.uuid]: item };
  }, {} as QuizMap);

  const nextState = action.payload.reduce((acc, item): State => {
    switch (item.lessonType) {
      case "new":
        return {
          ...acc,
          totalItems: acc.totalItems + 2,
          queue: {
            ...acc.queue,
            newWordIntro: [
              ...acc.queue.newWordIntro,
              {
                cardUUID: item.uuid,
                itemType: "newWordIntro" as const,
              },
            ],
            newWordOutro: [
              ...acc.queue.newWordOutro,
              {
                cardUUID: item.uuid,
                itemType: "newWordOutro" as const,
              },
            ],
          },
        };
      case "listening":
        return {
          ...acc,
          totalItems: acc.totalItems + 1,
          queue: {
            ...acc.queue,
            listening: [
              ...acc.queue.listening,
              { cardUUID: item.uuid, itemType: "listening" as const },
            ],
          },
        };
      case "speaking":
        return {
          ...acc,
          totalItems: acc.totalItems + 1,
          queue: {
            ...acc.queue,
            speaking: [
              ...acc.queue.speaking,
              { cardUUID: item.uuid, itemType: "speaking" as const },
            ],
          },
        };
      case "remedial":
        return {
          ...acc,
          totalItems: acc.totalItems + 2,
          queue: {
            ...acc.queue,
            remedialIntro: [
              ...acc.queue.remedialIntro,
              {
                cardUUID: item.uuid,
                itemType: "remedialIntro" as const,
              },
            ],
            remedialOutro: [
              ...acc.queue.remedialOutro,
              {
                cardUUID: item.uuid,
                itemType: "remedialOutro" as const,
              },
            ],
          },
        };
      default:
        throw new Error(`Unknown lesson type: ${item.lessonType}`);
    }
  }, state);
  return {
    ...nextState,
    cards,
  };
}
