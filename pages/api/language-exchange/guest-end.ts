import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { debugLanguageExchange } from "@/koala/language-exchange";
import {
  expireStaleLanguageExchangeRequests,
  getGuestLanguageExchangeRequestOrNull,
} from "@/koala/language-exchange-server";
import { prismaClient } from "@/koala/prisma-client";

const bodySchema = z.object({
  requestId: z.number().int().positive(),
  guestToken: z.string().trim().min(1).max(128),
});

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

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const now = new Date();
  await expireStaleLanguageExchangeRequests(now);

  const request = await getGuestLanguageExchangeRequestOrNull({
    requestId: parsed.data.requestId,
    guestToken: parsed.data.guestToken,
  });
  if (!request) {
    res.status(404).json({ error: "Call not found" });
    return;
  }

  const nextStatus = request.status === "WAITING" ? "CANCELLED" : "ENDED";

  await prismaClient.languageExchangeRequest.updateMany({
    where: {
      id: request.id,
      guestToken: parsed.data.guestToken,
      status: {
        in: ["WAITING", "MATCHED"],
      },
    },
    data: {
      status: nextStatus,
      endedAt: now,
    },
  });

  debugLanguageExchange("guest.request.ended", {
    requestId: request.id,
    nextStatus,
  });

  res.status(200).json({ ok: true });
}
