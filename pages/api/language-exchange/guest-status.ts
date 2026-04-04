import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { sessionDescriptionSchema } from "@/koala/language-exchange";
import {
  expireStaleLanguageExchangeRequests,
  getGuestLanguageExchangeRequestOrNull,
  touchGuestLanguageExchangeRequest,
} from "@/koala/language-exchange-server";

const querySchema = z.object({
  requestId: z.coerce.number().int().positive(),
  guestToken: z.string().trim().min(1).max(128),
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

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const now = new Date();
  await expireStaleLanguageExchangeRequests(now);

  const request = await getGuestLanguageExchangeRequestOrNull(parsed.data);
  if (!request) {
    res.status(404).json({ error: "Call not found" });
    return;
  }

  if (request.status === "WAITING" || request.status === "MATCHED") {
    await touchGuestLanguageExchangeRequest({
      requestId: request.id,
      status: request.status,
      now,
    });
  }

  const learnerAnswerSdp = request.learnerAnswerSdp
    ? sessionDescriptionSchema.safeParse(request.learnerAnswerSdp)
    : null;

  res.status(200).json({
    request: {
      requestId: request.id,
      guestToken: request.guestToken,
      status: request.status,
      expiresAt: request.expiresAt,
      matched: Boolean(request.claimedByUserId),
      learnerAnswerSdp: learnerAnswerSdp?.success
        ? learnerAnswerSdp.data
        : null,
    },
  });
}
