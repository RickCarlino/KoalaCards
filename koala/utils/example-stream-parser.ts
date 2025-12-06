const EXAMPLE_START = "[[EXAMPLE]]";
const EXAMPLE_END = "[[/EXAMPLE]]";
export const EXAMPLE_PLACEHOLDER = "[[__EXAMPLE_SLOT__]]";
const EDIT_START = "[[EDIT_CARD]]";
const EDIT_END = "[[/EDIT_CARD]]";
export const EDIT_PLACEHOLDER = "[[__EDIT_SLOT__]]";

type ExampleBlock = {
  phrase: string;
  translation: string;
};

export type CardEditBlock = {
  cardId?: number;
  term?: string;
  definition?: string;
  note?: string;
};

export type AssistantParserResult = {
  textDelta: string;
  examples: ExampleBlock[];
  edits: CardEditBlock[];
};

function getOverlap(source: string, token: string) {
  const max = Math.min(source.length, token.length - 1);
  for (let len = max; len > 0; len -= 1) {
    if (source.endsWith(token.slice(0, len))) {
      return len;
    }
  }
  return 0;
}

function parseExample(content: string): ExampleBlock | null {
  const normalized = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (normalized.length < 2) {
    return null;
  }
  return {
    phrase: normalized[0],
    translation: normalized.slice(1).join(" "),
  };
}

function parseEdit(content: string): CardEditBlock | null {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const edit: CardEditBlock = {};
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) {
      continue;
    }
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!value) {
      continue;
    }
    if (key === "cardid" || key === "id") {
      const parsedId = Number.parseInt(value, 10);
      if (Number.isFinite(parsedId)) {
        edit.cardId = parsedId;
      }
      continue;
    }
    if (key === "term") {
      edit.term = value;
      continue;
    }
    if (key === "definition") {
      edit.definition = value;
      continue;
    }
    if (key === "note" || key === "reason") {
      edit.note = value;
    }
  }

  if (
    !edit.cardId &&
    !edit.term &&
    !edit.definition &&
    !edit.note &&
    lines.length >= 2
  ) {
    return {
      term: lines[0],
      definition: lines.slice(1).join(" "),
    };
  }

  return edit;
}

type BlockType = "example" | "edit";

export function createAssistantStreamParser() {
  let buffer = "";
  let blockType: BlockType | null = null;
  let blockBuffer = "";

  const applyResult = (
    textDelta: string,
    examples: ExampleBlock[],
    edits: CardEditBlock[],
  ): AssistantParserResult => ({
    textDelta,
    examples,
    edits,
  });

  const resolveStartToken = (content: string) => {
    const exampleIdx = content.indexOf(EXAMPLE_START);
    const editIdx = content.indexOf(EDIT_START);

    if (exampleIdx === -1 && editIdx === -1) {
      return null;
    }

    if (exampleIdx === -1) {
      return { type: "edit" as const, index: editIdx };
    }

    if (editIdx === -1) {
      return { type: "example" as const, index: exampleIdx };
    }

    if (exampleIdx < editIdx) {
      return { type: "example" as const, index: exampleIdx };
    }

    return { type: "edit" as const, index: editIdx };
  };

  const getPlaceholder = (type: BlockType) =>
    type === "example" ? EXAMPLE_PLACEHOLDER : EDIT_PLACEHOLDER;

  const getStartToken = (type: BlockType) =>
    type === "example" ? EXAMPLE_START : EDIT_START;

  const getEndToken = (type: BlockType) =>
    type === "example" ? EXAMPLE_END : EDIT_END;

  const push = (chunk: string): AssistantParserResult => {
    buffer += chunk;
    let emittedText = "";
    const foundExamples: ExampleBlock[] = [];
    const foundEdits: CardEditBlock[] = [];

    while (buffer.length > 0) {
      if (blockType === null) {
        const match = resolveStartToken(buffer);
        if (!match) {
          const overlap = Math.max(
            getOverlap(buffer, EXAMPLE_START),
            getOverlap(buffer, EDIT_START),
          );
          const flushLen = buffer.length - overlap;
          if (flushLen > 0) {
            emittedText += buffer.slice(0, flushLen);
            buffer = buffer.slice(flushLen);
          }
          break;
        }
        const { type, index } = match;
        if (index > 0) {
          emittedText += buffer.slice(0, index);
        }
        buffer = buffer.slice(index + getStartToken(type).length);
        blockType = type;
        blockBuffer = "";
        continue;
      }

      const endToken = getEndToken(blockType);
      const endIdx = buffer.indexOf(endToken);
      if (endIdx === -1) {
        const overlap = getOverlap(buffer, endToken);
        const takeLen = buffer.length - overlap;
        if (takeLen > 0) {
          blockBuffer += buffer.slice(0, takeLen);
          buffer = buffer.slice(takeLen);
        }
        break;
      }

      blockBuffer += buffer.slice(0, endIdx);
      buffer = buffer.slice(endIdx + endToken.length);
      if (blockType === "example") {
        const parsedExample = parseExample(blockBuffer);
        if (parsedExample) {
          foundExamples.push(parsedExample);
          emittedText += getPlaceholder("example");
        } else {
          emittedText += blockBuffer;
        }
      } else {
        const parsedEdit = parseEdit(blockBuffer);
        if (parsedEdit) {
          foundEdits.push(parsedEdit);
          emittedText += getPlaceholder("edit");
        } else {
          emittedText += blockBuffer;
        }
      }
      blockType = null;
      blockBuffer = "";
    }

    return applyResult(emittedText, foundExamples, foundEdits);
  };

  const flush = (): AssistantParserResult => {
    if (blockType !== null) {
      buffer = "";
      blockBuffer = "";
      blockType = null;
      return applyResult("", [], []);
    }
    const text = buffer;
    buffer = "";
    return applyResult(text, [], []);
  };

  return { push, flush };
}

export const createExampleStreamParser = createAssistantStreamParser;
