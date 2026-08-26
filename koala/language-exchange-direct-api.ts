import type { User } from "@/koala/generated/prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  requireJsonGetMethod,
  requireJsonPostMethod,
  setNoStore,
} from "@/koala/api/next-api";
import { requireJsonApiUser } from "@/koala/get-api-user";
import {
  expireDirectLanguageExchangeCalls,
  findLanguageExchangeLinkBySlug,
} from "@/koala/language-exchange-direct-server";

const callIdParamsSchema = z.object({
  callId: z.coerce.number().int().positive(),
});

const slugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(64),
});

export function parseDirectCallId(
  req: NextApiRequest,
  res: NextApiResponse,
): number | null {
  const parsedParams = callIdParamsSchema.safeParse(req.query);
  if (parsedParams.success) {
    return parsedParams.data.callId;
  }

  res.status(400).json({ error: "Invalid request" });
  return null;
}

export async function requireDirectPostUser(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<User | null> {
  if (!requireJsonPostMethod(req, res)) {
    return null;
  }

  return requireJsonApiUser(req, res);
}

export async function prepareDirectLearnerCallMutation(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<{ callId: number; now: Date; user: User } | null> {
  const user = await requireDirectPostUser(req, res);
  if (!user) {
    return null;
  }

  const callId = parseDirectCallId(req, res);
  if (!callId) {
    return null;
  }

  const now = new Date();
  await expireDirectLanguageExchangeCalls(now);

  return { callId, now, user };
}

export function rejectUnavailableDirectCall(
  res: NextApiResponse,
  count: number,
): boolean {
  if (count === 1) {
    return false;
  }

  res.status(404).json({ error: "Call is no longer available" });
  return true;
}

export async function resolveDirectLinkRequest(options: {
  invalidMessage: string;
  method: "GET" | "POST";
  req: NextApiRequest;
  res: NextApiResponse;
}) {
  const { invalidMessage, method, req, res } = options;
  if (method === "GET" && !requireJsonGetMethod(req, res)) {
    return null;
  }
  if (method === "POST" && !requireJsonPostMethod(req, res)) {
    return null;
  }
  if (method === "GET") {
    setNoStore(res);
  }

  const parsedParams = slugParamsSchema.safeParse(req.query);
  if (!parsedParams.success) {
    res.status(400).json({ error: invalidMessage });
    return null;
  }

  const now = new Date();
  await expireDirectLanguageExchangeCalls(now);

  const link = await findLanguageExchangeLinkBySlug(
    parsedParams.data.slug,
  );
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return null;
  }

  return { link, now };
}
