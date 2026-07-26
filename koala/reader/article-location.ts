export function scrollToArticleHighlight(
  articleElement: HTMLElement | null,
  highlightId: number,
): boolean {
  const mark = articleElement?.querySelector<HTMLElement>(
    `mark[data-highlight-id="${highlightId}"]`,
  );
  if (!mark) {
    return false;
  }

  mark.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}
