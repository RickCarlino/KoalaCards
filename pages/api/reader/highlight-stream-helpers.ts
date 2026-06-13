import { prismaClient } from "@/koala/prisma-client";
import type { ReaderHighlightAnalysis } from "@/koala/reader/highlight-explain";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

function writeSSE(
  res: NextApiResponse,
  data: string,
  event?: string,
): void {
  if (event) {
    res.write(`event: ${event}\n`);
  }

  const lines = data.split("\n");
  for (const line of lines) {
    res.write(`data: ${line}\n`);
  }

  res.write("\n");
}

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
  if (req.method === "POST") {
    return true;
  }

  res.setHeader("Allow", "POST");
  res.status(405).end("Method Not Allowed");
  return false;
}

export async function requireReaderApiUserId(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string | null> {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    res.status(401).end("Unauthorized");
    return null;
  }

  const user = await prismaClient.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    res.status(401).end("Unauthorized");
    return null;
  }

  return user.id;
}
