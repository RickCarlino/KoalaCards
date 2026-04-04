import type { NextApiRequest, NextApiResponse } from "next";
import { debugLanguageExchange } from "@/koala/language-exchange";
import {
  createLanguageExchangeRequest,
  expireStaleLanguageExchangeRequests,
} from "@/koala/language-exchange-server";

function requirePostMethod(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  if (req.method === "POST") {
    return true;
  }

  res.setHeader("Allow", "POST");
  res.status(405).json({ error: "Method Not Allowed" });
  return false;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requirePostMethod(req, res)) {
    return;
  }

  const now = new Date();
  await expireStaleLanguageExchangeRequests(now);
  const request = await createLanguageExchangeRequest(now);
  debugLanguageExchange("guest.request.created", {
    requestId: request.id,
    createdAt: request.createdAt.toISOString(),
  });

  res.status(200).json({
    requestId: request.id,
    guestToken: request.guestToken,
    status: request.status,
    expiresAt: request.expiresAt,
  });
}
