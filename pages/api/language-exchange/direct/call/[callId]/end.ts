import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getApiUserOrNull } from "@/koala/get-api-user";
import {
  expireDirectLanguageExchangeCalls,
  findGuestDirectLanguageExchangeCallOrNull,
} from "@/koala/language-exchange-direct-server";
import { prismaClient } from "@/koala/prisma-client";

const paramsSchema = z.object({
  callId: z.coerce.number().int().positive(),
});

const bodySchema = z.object({
  guestToken: z.string().trim().min(1).max(128).optional(),
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

  const parsedParams = paramsSchema.safeParse(req.query);
  const parsedBody = bodySchema.safeParse(req.body ?? {});
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const now = new Date();
  await expireDirectLanguageExchangeCalls(now);

  const user = await getApiUserOrNull(req, res);
  if (user) {
    const ended = await prismaClient.languageExchangeCall.updateMany({
      where: {
        id: parsedParams.data.callId,
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
    callId: parsedParams.data.callId,
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
