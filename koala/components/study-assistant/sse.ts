export type SseStreamHandlers = {
  onChunk: (payload: string) => void;
  onDone: () => void;
};

type SseEvent = { event: string | null; data: string };

function parseSseEvent(chunk: string): SseEvent {
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      const valueLine = line.slice(5).replace(/^ /, "");
      dataLines.push(valueLine);
    }
  }

  return { event, data: dataLines.join("\n") };
}

export async function readSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: SseStreamHandlers,
) {
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const parsed = parseSseEvent(part);
      if (parsed.event === "done") {
        finished = true;
        handlers.onDone();
        break;
      }
      handlers.onChunk(parsed.data);
    }
  }

  if (!finished) {
    handlers.onDone();
  }
}
