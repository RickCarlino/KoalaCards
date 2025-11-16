const EXAMPLE_START = "[[EXAMPLE]]";
const EXAMPLE_END = "[[/EXAMPLE]]";

type ExampleBlock = {
  phrase: string;
  translation: string;
};

export type ExampleParserResult = {
  textDelta: string;
  examples: ExampleBlock[];
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

export function createExampleStreamParser() {
  let buffer = "";
  let collectingExample = false;
  let exampleBuffer = "";

  const applyResult = (textDelta: string, examples: ExampleBlock[]) => ({
    textDelta,
    examples,
  });

  const push = (chunk: string): ExampleParserResult => {
    buffer += chunk;
    let emittedText = "";
    const foundExamples: ExampleBlock[] = [];

    while (buffer.length > 0) {
      if (!collectingExample) {
        const startIdx = buffer.indexOf(EXAMPLE_START);
        if (startIdx === -1) {
          const overlap = getOverlap(buffer, EXAMPLE_START);
          const flushLen = buffer.length - overlap;
          if (flushLen > 0) {
            emittedText += buffer.slice(0, flushLen);
            buffer = buffer.slice(flushLen);
          }
          break;
        }
        if (startIdx > 0) {
          emittedText += buffer.slice(0, startIdx);
        }
        buffer = buffer.slice(startIdx + EXAMPLE_START.length);
        collectingExample = true;
        exampleBuffer = "";
        continue;
      }

      const endIdx = buffer.indexOf(EXAMPLE_END);
      if (endIdx === -1) {
        const overlap = getOverlap(buffer, EXAMPLE_END);
        const takeLen = buffer.length - overlap;
        if (takeLen > 0) {
          exampleBuffer += buffer.slice(0, takeLen);
          buffer = buffer.slice(takeLen);
        }
        break;
      }

      exampleBuffer += buffer.slice(0, endIdx);
      buffer = buffer.slice(endIdx + EXAMPLE_END.length);
      const parsed = parseExample(exampleBuffer);
      if (parsed) {
        foundExamples.push(parsed);
      }
      exampleBuffer = "";
      collectingExample = false;
    }

    return applyResult(emittedText, foundExamples);
  };

  const flush = (): ExampleParserResult => {
    if (collectingExample) {
      buffer = "";
      exampleBuffer = "";
      collectingExample = false;
      return applyResult("", []);
    }
    const text = buffer;
    buffer = "";
    return applyResult(text, []);
  };

  return { push, flush };
}
