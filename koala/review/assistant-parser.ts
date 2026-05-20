export type ExampleBlock = {
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

export type AssistantCardContext = {
  cardId: number;
  term: string;
  definition: string;
  uuid?: string;
};

export type AssistantEditProposal = {
  id: string;
  cardId: number;
  term: string;
  definition: string;
  note?: string;
  originalTerm?: string;
  originalDefinition?: string;
};

type BlockType = "example" | "edit";

type ParsedEditField = {
  key: string;
  value: string;
};

type ParserState = {
  buffer: string;
  blockType: BlockType | null;
  blockBuffer: string;
};

type ParserAccumulator = {
  emittedText: string;
  foundExamples: ExampleBlock[];
  foundEdits: CardEditBlock[];
};

const EXAMPLE_START = "[[EXAMPLE]]";
const EXAMPLE_END = "[[/EXAMPLE]]";
export const EXAMPLE_PLACEHOLDER = "[[__EXAMPLE_SLOT__]]";
const EDIT_START = "[[EDIT_CARD]]";
const EDIT_END = "[[/EDIT_CARD]]";
export const EDIT_PLACEHOLDER = "[[__EDIT_SLOT__]]";

function applyResult(
  textDelta: string,
  examples: ExampleBlock[],
  edits: CardEditBlock[],
): AssistantParserResult {
  return {
    textDelta,
    examples,
    edits,
  };
}

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

function parseEditField(line: string): ParsedEditField | null {
  const [rawKey, ...rest] = line.split(":");
  if (!rawKey || rest.length === 0) {
    return null;
  }

  const value = rest.join(":").trim();
  if (!value) {
    return null;
  }

  return {
    key: rawKey.trim().toLowerCase(),
    value,
  };
}

function parseCardId(value: string): number | null {
  const parsedId = Number.parseInt(value, 10);
  if (Number.isFinite(parsedId)) {
    return parsedId;
  }
  return null;
}

function hasEditData(edit: CardEditBlock): boolean {
  return Boolean(edit.cardId || edit.term || edit.definition || edit.note);
}

const EDIT_FIELD_HANDLERS: Record<
  string,
  (edit: CardEditBlock, value: string) => void
> = {
  cardid: (edit, value) => {
    const parsedId = parseCardId(value);
    if (parsedId !== null) {
      edit.cardId = parsedId;
    }
  },
  id: (edit, value) => {
    const parsedId = parseCardId(value);
    if (parsedId !== null) {
      edit.cardId = parsedId;
    }
  },
  term: (edit, value) => {
    edit.term = value;
  },
  definition: (edit, value) => {
    edit.definition = value;
  },
  note: (edit, value) => {
    edit.note = value;
  },
  reason: (edit, value) => {
    edit.note = value;
  },
};

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
    const field = parseEditField(line);
    if (!field) {
      continue;
    }
    const handler = EDIT_FIELD_HANDLERS[field.key];
    if (handler) {
      handler(edit, field.value);
    }
  }

  if (!hasEditData(edit) && lines.length >= 2) {
    return {
      term: lines[0],
      definition: lines.slice(1).join(" "),
    };
  }

  return edit;
}

function resolveStartToken(content: string) {
  const exampleIdx = content.indexOf(EXAMPLE_START);
  const editIdx = content.indexOf(EDIT_START);

  if (exampleIdx === -1 && editIdx === -1) {
    return null;
  }
  if (exampleIdx === -1) {
    return { type: "edit" as const, index: editIdx };
  }
  if (editIdx === -1 || exampleIdx < editIdx) {
    return { type: "example" as const, index: exampleIdx };
  }
  return { type: "edit" as const, index: editIdx };
}

function getPlaceholder(type: BlockType) {
  return type === "example" ? EXAMPLE_PLACEHOLDER : EDIT_PLACEHOLDER;
}

function getStartToken(type: BlockType) {
  return type === "example" ? EXAMPLE_START : EDIT_START;
}

function getEndToken(type: BlockType) {
  return type === "example" ? EXAMPLE_END : EDIT_END;
}

function resolveTargetCard(
  latestCard: AssistantCardContext | undefined,
  resolvedCardId: number,
) {
  if (latestCard && resolvedCardId === latestCard.cardId) {
    return latestCard;
  }
  return undefined;
}

function resolveProposalField(
  draftValue: string | undefined,
  fallbackValue: string | undefined,
): string {
  return draftValue?.trim() || fallbackValue || "";
}

function appendParsedBlock(
  blockType: BlockType,
  blockBuffer: string,
  accumulator: ParserAccumulator,
) {
  if (blockType === "example") {
    const parsedExample = parseExample(blockBuffer);
    if (parsedExample) {
      accumulator.foundExamples.push(parsedExample);
      accumulator.emittedText += getPlaceholder("example");
      return;
    }
  } else {
    const parsedEdit = parseEdit(blockBuffer);
    if (parsedEdit) {
      accumulator.foundEdits.push(parsedEdit);
      accumulator.emittedText += getPlaceholder("edit");
      return;
    }
  }

  accumulator.emittedText += blockBuffer;
}

function consumeTextBuffer(
  state: ParserState,
  accumulator: ParserAccumulator,
): boolean {
  const match = resolveStartToken(state.buffer);
  if (!match) {
    const overlap = Math.max(
      getOverlap(state.buffer, EXAMPLE_START),
      getOverlap(state.buffer, EDIT_START),
    );
    const flushLen = state.buffer.length - overlap;
    if (flushLen > 0) {
      accumulator.emittedText += state.buffer.slice(0, flushLen);
      state.buffer = state.buffer.slice(flushLen);
    }
    return false;
  }

  if (match.index > 0) {
    accumulator.emittedText += state.buffer.slice(0, match.index);
  }
  state.buffer = state.buffer.slice(
    match.index + getStartToken(match.type).length,
  );
  state.blockType = match.type;
  state.blockBuffer = "";
  return true;
}

function consumeStructuredBlock(
  state: ParserState,
  accumulator: ParserAccumulator,
): boolean {
  const blockType = state.blockType;
  if (!blockType) {
    return false;
  }

  const endToken = getEndToken(blockType);
  const endIdx = state.buffer.indexOf(endToken);
  if (endIdx === -1) {
    const overlap = getOverlap(state.buffer, endToken);
    const takeLen = state.buffer.length - overlap;
    if (takeLen > 0) {
      state.blockBuffer += state.buffer.slice(0, takeLen);
      state.buffer = state.buffer.slice(takeLen);
    }
    return false;
  }

  state.blockBuffer += state.buffer.slice(0, endIdx);
  state.buffer = state.buffer.slice(endIdx + endToken.length);
  appendParsedBlock(blockType, state.blockBuffer, accumulator);
  state.blockType = null;
  state.blockBuffer = "";
  return true;
}

export function createAssistantStreamParser() {
  const state: ParserState = {
    buffer: "",
    blockType: null,
    blockBuffer: "",
  };

  return {
    push(chunk: string): AssistantParserResult {
      state.buffer += chunk;
      const accumulator: ParserAccumulator = {
        emittedText: "",
        foundExamples: [],
        foundEdits: [],
      };

      while (state.buffer.length > 0) {
        const advanced =
          state.blockType === null
            ? consumeTextBuffer(state, accumulator)
            : consumeStructuredBlock(state, accumulator);
        if (!advanced) {
          break;
        }
      }

      return applyResult(
        accumulator.emittedText,
        accumulator.foundExamples,
        accumulator.foundEdits,
      );
    },
    flush(): AssistantParserResult {
      if (state.blockType !== null) {
        state.buffer = "";
        state.blockBuffer = "";
        state.blockType = null;
        return applyResult("", [], []);
      }

      const text = state.buffer;
      state.buffer = "";
      return applyResult(text, [], []);
    },
  };
}

export function buildAssistantEditProposal(options: {
  draft: CardEditBlock;
  latestCard?: AssistantCardContext;
  createProposalId: (cardId: number) => string;
}): AssistantEditProposal | null {
  const resolvedCardId =
    options.draft.cardId ?? options.latestCard?.cardId;
  if (!resolvedCardId) {
    return null;
  }

  const targetCard = resolveTargetCard(options.latestCard, resolvedCardId);
  const resolvedTerm = resolveProposalField(
    options.draft.term,
    targetCard?.term,
  );
  const resolvedDefinition = resolveProposalField(
    options.draft.definition,
    targetCard?.definition,
  );

  if (!resolvedTerm && !resolvedDefinition) {
    return null;
  }

  return {
    id: options.createProposalId(resolvedCardId),
    cardId: resolvedCardId,
    term: resolvedTerm,
    definition: resolvedDefinition,
    note: options.draft.note,
    originalTerm: targetCard?.term,
    originalDefinition: targetCard?.definition,
  };
}
