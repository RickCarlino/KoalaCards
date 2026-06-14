import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getApiUserOrNull } from "@/koala/get-api-user";
import { requireJsonPostMethod } from "@/koala/api/next-api";
import { parseDirectCallId } from "@/koala/language-exchange-direct-api";
import {
  expireDirectLanguageExchangeCalls,
  findGuestDirectLanguageExchangeCallOrNull,
} from "@/koala/language-exchange-direct-server";
import { prismaClient } from "@/koala/prisma-client";

const bodySchema = z.object({
  guestToken: z.string().trim().min(1).max(128).optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireJsonPostMethod(req, res)) {
    return;
  }

  const callId = parseDirectCallId(req, res);
  if (!callId) {
    return;
  }

  const parsedBody = bodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const now = new Date();
  await expireDirectLanguageExchangeCalls(now);

  const user = await getApiUserOrNull(req, res);
  if (user) {
    const ended = await prismaClient.languageExchangeCall.updateMany({
      where: {
        id: callId,
        learnerId: user.id,
        status: {
          in: ["RINGING", "ACTIVE"],
        },
      },
      data: {
        status: "ENDED",
        endedAt: now,
      },
    });

    if (ended.count !== 1) {
      res.status(404).json({ error: "Call already ended" });
      return;
    }

    res.status(200).json({ ok: true });
    return;
  }

  if (!parsedBody.data.guestToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const call = await findGuestDirectLanguageExchangeCallOrNull({
    callId,
    guestToken: parsedBody.data.guestToken,
  });
  if (!call) {
    res.status(404).json({ error: "Call not found" });
    return;
  }

  const nextStatus = call.status === "RINGING" ? "CANCELLED" : "ENDED";

  await prismaClient.languageExchangeCall.updateMany({
    where: {
      id: call.id,
      guestToken: parsedBody.data.guestToken,
      status: {
        in: ["RINGING", "ACTIVE"],
      },
    },
    data: {
      status: nextStatus,
      endedAt: now,
    },
  });

  res.status(200).json({ ok: true });
}
