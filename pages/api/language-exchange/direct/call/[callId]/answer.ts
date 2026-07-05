import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  prepareDirectLearnerCallMutation,
  rejectUnavailableDirectCall,
} from "@/koala/language-exchange-direct-api";
import {
  directLanguageExchangeSessionDescriptionSchema,
  getDirectLanguageExchangeActiveExpiry,
} from "@/koala/language-exchange-direct";
import {
  findActiveDirectLanguageExchangeCallForLearner,
  mapDirectLanguageExchangeCall,
} from "@/koala/language-exchange-direct-server";
import { prismaClient } from "@/koala/prisma-client";

const bodySchema = z.object({
  answer: directLanguageExchangeSessionDescriptionSchema.refine(
    (value) => value.type === "answer",
    "Expected answer SDP.",
  ),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const prepared = await prepareDirectLearnerCallMutation(req, res);
  if (!prepared) {
    return;
  }

  const parsedBody = bodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const updated = await prismaClient.languageExchangeCall.updateMany({
    where: {
      id: prepared.callId,
      learnerId: prepared.user.id,
      status: "RINGING",
    },
    data: {
      status: "ACTIVE",
      answerSdp: parsedBody.data.answer,
      acceptedAt: prepared.now,
      learnerHeartbeatAt: prepared.now,
      expiresAt: getDirectLanguageExchangeActiveExpiry(prepared.now),
    },
  });

  if (rejectUnavailableDirectCall(res, updated.count)) {
    return;
  }

  const call = await findActiveDirectLanguageExchangeCallForLearner(
    prepared.user.id,
    prepared.now,
  );

  res.status(200).json({
    call: mapDirectLanguageExchangeCall(call),
  });
}
