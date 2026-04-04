import type { NextApiRequest, NextApiResponse } from "next";
import { debugLanguageExchange } from "@/koala/language-exchange";
import {
  countAvailableLanguageExchangeLearners,
  expireStaleLanguageExchangeRequests,
} from "@/koala/language-exchange-server";

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

  const now = new Date();
  await expireStaleLanguageExchangeRequests(now);
  const availableLearners =
    await countAvailableLanguageExchangeLearners(now);
  debugLanguageExchange("available.count", {
    availableLearners,
    now: now.toISOString(),
  });
  res.status(200).json({ availableLearners });
}
