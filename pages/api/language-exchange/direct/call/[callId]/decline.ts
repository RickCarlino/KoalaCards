import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getApiUserOrNull } from "@/koala/get-api-user";
import { expireDirectLanguageExchangeCalls } from "@/koala/language-exchange-direct-server";
import { prismaClient } from "@/koala/prisma-client";

const paramsSchema = z.object({
  callId: z.coerce.number().int().positive(),
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
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const now = new Date();
  await expireDirectLanguageExchangeCalls(now);

  const declined = await prismaClient.languageExchangeCall.updateMany({
    where: {
      id: parsedParams.data.callId,
      learnerId: user.id,
      status: "RINGING",
    },
    data: {
      status: "DECLINED",
      endedAt: now,
    },
  });

  if (declined.count !== 1) {
    res.status(404).json({ error: "Call is no longer available" });
    return;
  }

  res.status(200).json({ ok: true });
}
