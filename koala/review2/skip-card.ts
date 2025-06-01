import { SkipCardAction, State, EVERY_QUEUE_TYPE } from "./types";

export function skipCard(action: SkipCardAction, state: State): State {
  const cardUUID = action.payload.uuid;
  const newQueue = { ...state.queue };
  for (const type of EVERY_QUEUE_TYPE) {
    newQueue[type] = newQueue[type].filter(
      (item) => item.cardUUID !== cardUUID,
    );
  }
  return {
    ...state,
    queue: newQueue,
    itemsComplete: state.itemsComplete + 1,
  };
}
