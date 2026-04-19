import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  expireDirectLanguageExchangeCalls,
  findGuestDirectLanguageExchangeCallOrNull,
  mapDirectLanguageExchangeCall,
  touchGuestDirectLanguageExchangeCall,
} from "@/koala/language-exchange-direct-server";

const paramsSchema = z.object({
  callId: z.coerce.number().int().positive(),
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

  const parsedParams = paramsSchema.safeParse({
    callId: req.query.callId,
    guestToken: req.query.guestToken,
  });
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const now = new Date();
  await expireDirectLanguageExchangeCalls(now);
  await touchGuestDirectLanguageExchangeCall({
    callId: parsedParams.data.callId,
    guestToken: parsedParams.data.guestToken,
    now,
  });

  const call = await findGuestDirectLanguageExchangeCallOrNull({
    callId: parsedParams.data.callId,
    guestToken: parsedParams.data.guestToken,
  });

  if (!call) {
    res.status(404).json({ error: "Call not found" });
    return;
  }

  res.status(200).json({
    call: mapDirectLanguageExchangeCall(call),
  });
}
