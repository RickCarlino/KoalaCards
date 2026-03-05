export type ArticleHighlightDomRange = {
  highlightId: number;
  startOffset: number;
  endOffset: number;
};

type TextPosition = {
  node: Text;
  offset: number;
};

function textPositionAtOffset(
  container: HTMLElement,
  targetOffset: number,
): TextPosition | null {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
  );

  let consumed = 0;
  let lastNode: Text | null = null;
  let node = walker.nextNode() as Text | null;

  while (node) {
    const length = node.nodeValue?.length ?? 0;
    const nextConsumed = consumed + length;
    if (targetOffset <= nextConsumed) {
      return {
        node,
        offset: Math.max(0, Math.min(length, targetOffset - consumed)),
      };
    }

    consumed = nextConsumed;
    lastNode = node;
    node = walker.nextNode() as Text | null;
  }

  if (!lastNode) {
    return null;
  }

  return {
    node: lastNode,
    offset: lastNode.nodeValue?.length ?? 0,
  };
}

export function clearRenderedArticleHighlights(
  container: HTMLElement,
): void {
  const marks = container.querySelectorAll("mark[data-reader-highlight]");
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) {
      continue;
    }

    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }
}

export function applyRenderedArticleHighlights(
  container: HTMLElement,
  ranges: ArticleHighlightDomRange[],
): void {
  const descending = [...ranges].sort((left, right) => {
    if (left.startOffset !== right.startOffset) {
      return right.startOffset - left.startOffset;
    }

    return right.endOffset - left.endOffset;
  });

  for (const range of descending) {
    if (range.endOffset <= range.startOffset) {
      continue;
    }

    const start = textPositionAtOffset(container, range.startOffset);
    const end = textPositionAtOffset(container, range.endOffset);
    if (!start || !end) {
      continue;
    }

    const domRange = document.createRange();
    domRange.setStart(start.node, start.offset);
    domRange.setEnd(end.node, end.offset);

    if (domRange.collapsed) {
      continue;
    }

    const mark = document.createElement("mark");
    mark.setAttribute("data-reader-highlight", "saved");
    mark.setAttribute("data-highlight-id", String(range.highlightId));

    const fragment = domRange.extractContents();
    mark.appendChild(fragment);
    domRange.insertNode(mark);
  }
}
