import type { ReaderHighlightAnalysis } from "./contracts";

export type ReaderExplainStreamHandlers = {
  onHighlightId: (highlightId: number) => void;
  onAnalysis: (analysis: ReaderHighlightAnalysis) => void;
  onError: (message: string) => void;
  onDone: () => void;
};

export type ReaderSseEvent = {
  event: string;
  data: string;
};

export function parseReaderSseEvent(
  rawEvent: string,
): ReaderSseEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join("\n") };
}

function readHighlightId(
  data: string,
  handlers: ReaderExplainStreamHandlers,
): void {
  try {
    const payload = JSON.parse(data) as { id?: unknown };
    if (typeof payload.id === "number" && Number.isFinite(payload.id)) {
      handlers.onHighlightId(payload.id);
      return;
    }
  } catch {
    handlers.onError("Unable to read saved highlight.");
    return;
  }

  handlers.onError("Unable to read saved highlight.");
}

function readAnalysis(
  data: string,
  handlers: ReaderExplainStreamHandlers,
): void {
  try {
    handlers.onAnalysis(JSON.parse(data) as ReaderHighlightAnalysis);
  } catch {
    handlers.onError("Unable to read structured analysis.");
  }
}

function handleReaderSseEvent(
  event: ReaderSseEvent,
  handlers: ReaderExplainStreamHandlers,
): boolean {
  if (event.event === "done") {
    return true;
  }
  if (event.event === "highlight") {
    readHighlightId(event.data, handlers);
    return false;
  }
  if (event.event === "analysis") {
    readAnalysis(event.data, handlers);
    return false;
  }
  if (event.event === "error") {
    handlers.onError(event.data || "Streaming failed.");
  }

  return false;
}

export async function readReaderExplainStream(
  response: Response,
  handlers: ReaderExplainStreamHandlers,
): Promise<void> {
  if (!response.ok || !response.body) {
    const message = await response.text();
    throw new Error(message || "Unable to start explanation.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  while (!finished) {
    const next = await reader.read();
    if (next.done) {
      break;
    }

    buffer += decoder.decode(next.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const event = parseReaderSseEvent(rawEvent);
      if (event && handleReaderSseEvent(event, handlers)) {
        finished = true;
        break;
      }
    }
  }

  handlers.onDone();
}
