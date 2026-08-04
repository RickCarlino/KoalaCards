export const ARTICLE_SELECTION_COMPLETION_EVENTS = [
  "mouseup",
  "touchend",
  "keyup",
] as const;

type ArticleSelectionEventTarget = Pick<
  EventTarget,
  "addEventListener" | "removeEventListener"
>;

export function clearCompletedReaderSelection(
  selection: Pick<Selection, "removeAllRanges"> | null | undefined,
): void {
  selection?.removeAllRanges();
}

export function listenForCompletedArticleSelections(
  target: ArticleSelectionEventTarget,
  listener: EventListener,
): () => void {
  for (const eventName of ARTICLE_SELECTION_COMPLETION_EVENTS) {
    target.addEventListener(eventName, listener);
  }

  return () => {
    for (const eventName of ARTICLE_SELECTION_COMPLETION_EVENTS) {
      target.removeEventListener(eventName, listener);
    }
  };
}
