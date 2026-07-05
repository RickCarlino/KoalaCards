import type { NextApiRequest, NextApiResponse } from "next";
import {
  prepareDirectLearnerCallMutation,
  rejectUnavailableDirectCall,
} from "@/koala/language-exchange-direct-api";
import { prismaClient } from "@/koala/prisma-client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const prepared = await prepareDirectLearnerCallMutation(req, res);
  if (!prepared) {
    return;
  }

  const declined = await prismaClient.languageExchangeCall.updateMany({
    where: {
      id: prepared.callId,
      learnerId: prepared.user.id,
      status: "RINGING",
    },
    data: {
      status: "DECLINED",
      endedAt: prepared.now,
    },
  });

  if (rejectUnavailableDirectCall(res, declined.count)) {
    return;
  }

  res.status(200).json({ ok: true });
}
