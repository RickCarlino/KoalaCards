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

function collectIntersectingTextNodes(
  container: HTMLElement,
  domRange: Range,
): Text[] {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
  );
  const nodes: Text[] = [];
  let node = walker.nextNode() as Text | null;

  while (node) {
    const length = node.nodeValue?.length ?? 0;
    if (length > 0 && domRange.intersectsNode(node)) {
      nodes.push(node);
    }

    node = walker.nextNode() as Text | null;
  }

  return nodes;
}

function wrapTextNodeSlice(options: {
  node: Text;
  startOffset: number;
  endOffset: number;
  highlightId: number;
}): void {
  const { node, startOffset, endOffset, highlightId } = options;
  const textLength = node.nodeValue?.length ?? 0;
  const safeStart = Math.max(0, Math.min(textLength, startOffset));
  const safeEnd = Math.max(safeStart, Math.min(textLength, endOffset));
  if (safeEnd <= safeStart) {
    return;
  }

  let highlightedTextNode = node;
  if (safeStart > 0) {
    highlightedTextNode = highlightedTextNode.splitText(safeStart);
  }

  const highlightLength = safeEnd - safeStart;
  const highlightedNodeLength = highlightedTextNode.nodeValue?.length ?? 0;
  if (highlightLength < highlightedNodeLength) {
    highlightedTextNode.splitText(highlightLength);
  }

  const parent = highlightedTextNode.parentNode;
  if (!parent) {
    return;
  }

  const mark = document.createElement("mark");
  mark.setAttribute("data-reader-highlight", "saved");
  mark.setAttribute("data-highlight-id", String(highlightId));
  parent.insertBefore(mark, highlightedTextNode);
  mark.appendChild(highlightedTextNode);
}

function applyDomRangeHighlight(options: {
  container: HTMLElement;
  domRange: Range;
  highlightId: number;
}): void {
  const { container, domRange, highlightId } = options;
  const textNodes = collectIntersectingTextNodes(container, domRange);

  for (const textNode of textNodes) {
    const nodeLength = textNode.nodeValue?.length ?? 0;
    const startOffset =
      textNode === domRange.startContainer ? domRange.startOffset : 0;
    const endOffset =
      textNode === domRange.endContainer ? domRange.endOffset : nodeLength;

    wrapTextNodeSlice({
      node: textNode,
      startOffset,
      endOffset,
      highlightId,
    });
  }
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

    applyDomRangeHighlight({
      container,
      domRange,
      highlightId: range.highlightId,
    });
  }
}
