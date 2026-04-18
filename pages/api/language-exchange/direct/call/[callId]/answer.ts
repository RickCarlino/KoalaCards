import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getApiUserOrNull } from "@/koala/get-api-user";
import { sessionDescriptionSchema } from "@/koala/language-exchange";
import { getDirectLanguageExchangeActiveExpiry } from "@/koala/language-exchange-direct";
import {
  expireDirectLanguageExchangeCalls,
  findActiveDirectLanguageExchangeCallForLearner,
  mapDirectLanguageExchangeCall,
} from "@/koala/language-exchange-direct-server";
import { prismaClient } from "@/koala/prisma-client";

const paramsSchema = z.object({
  callId: z.coerce.number().int().positive(),
});

const bodySchema = z.object({
  answer: sessionDescriptionSchema.refine(
    (value) => value.type === "answer",
    "Expected answer SDP.",
  ),
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

  const user = await getApiUserOrNull(req, res);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsedParams = paramsSchema.safeParse(req.query);
  const parsedBody = bodySchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const now = new Date();
  await expireDirectLanguageExchangeCalls(now);

  const updated = await prismaClient.languageExchangeCall.updateMany({
    where: {
      id: parsedParams.data.callId,
      learnerId: user.id,
      status: "RINGING",
    },
    data: {
      status: "ACTIVE",
      answerSdp: parsedBody.data.answer,
      acceptedAt: now,
      learnerHeartbeatAt: now,
      expiresAt: getDirectLanguageExchangeActiveExpiry(now),
    },
  });

  if (updated.count !== 1) {
    res.status(404).json({ error: "Call is no longer available" });
    return;
  }

  const call = await findActiveDirectLanguageExchangeCallForLearner(
    user.id,
    now,
  );

  res.status(200).json({
    call: mapDirectLanguageExchangeCall(call),
  });
}
