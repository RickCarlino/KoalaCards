import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  findLanguageExchangeLinkBySlug,
  expireDirectLanguageExchangeCalls,
  getLanguageExchangeAvailabilityStatus,
} from "@/koala/language-exchange-direct-server";

const paramsSchema = z.object({
  slug: z.string().trim().min(1).max(64),
});

function requireGetMethod(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  if (req.method === "GET") {
    return true;
  }

  res.setHeader("Allow", "GET");
  res.status(405).json({ error: "Method Not Allowed" });
  return false;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireGetMethod(req, res)) {
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  const parsedParams = paramsSchema.safeParse(req.query);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid link" });
    return;
  }

  const now = new Date();
  await expireDirectLanguageExchangeCalls(now);

  const link = await findLanguageExchangeLinkBySlug(
    parsedParams.data.slug,
  );
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const status = await getLanguageExchangeAvailabilityStatus({
    userId: link.userId,
    now,
  });

  res.status(200).json({ status });
}
