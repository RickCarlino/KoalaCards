import type { NextApiRequest, NextApiResponse } from "next";
import type { ReaderHighlightAnalysis } from "@/koala/reader/highlight-explain";
import { requireTextPostMethod } from "@/koala/api/next-api";
import { writeSSE } from "@/koala/api/sse";
import { requireTextApiUserId } from "@/koala/get-api-user";

export function startSSE(res: NextApiResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
}

export function streamDone(res: NextApiResponse, isClosed: boolean): void {
  if (isClosed) {
    return;
  }

  writeSSE(res, "done", "done");
  res.end();
}

export function streamError(options: {
  res: NextApiResponse;
  isClosed: boolean;
  message: string;
}): void {
  if (options.isClosed) {
    return;
  }

  writeSSE(options.res, options.message, "error");
  streamDone(options.res, options.isClosed);
}

export function streamAnalysis(options: {
  res: NextApiResponse;
  isClosed: boolean;
  analysis: ReaderHighlightAnalysis;
}): void {
  if (options.isClosed) {
    return;
  }

  writeSSE(options.res, JSON.stringify(options.analysis), "analysis");
}

export function streamHighlightId(options: {
  res: NextApiResponse;
  isClosed: boolean;
  highlightId: number;
}): void {
  if (options.isClosed) {
    return;
  }

  writeSSE(
    options.res,
    JSON.stringify({ id: options.highlightId }),
    "highlight",
  );
}

export function trimStreamErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, 1800);
  }

  return "Unexpected streaming error.";
}

export function requirePostMethod(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  return requireTextPostMethod(req, res);
}

export async function requireReaderApiUserId(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string | null> {
  return requireTextApiUserId(req, res);
}

export function trackRequestClosed(req: NextApiRequest): () => boolean {
  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  return () => closed;
}
