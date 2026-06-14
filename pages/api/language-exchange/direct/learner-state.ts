import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireJsonGetMethod, setNoStore } from "@/koala/api/next-api";
import { requireJsonApiUser } from "@/koala/get-api-user";
import { getUserSettings } from "@/koala/auth-helpers";
import {
  expireDirectLanguageExchangeCalls,
  findActiveDirectLanguageExchangeCallForLearner,
  findIncomingDirectLanguageExchangeCallForLearner,
  mapDirectLanguageExchangeCall,
  touchLearnerDirectLanguageExchangeCall,
} from "@/koala/language-exchange-direct-server";

const querySchema = z.object({
  activeCallId: z.coerce.number().int().positive().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireJsonGetMethod(req, res)) {
    return;
  }

  setNoStore(res);

  const user = await requireJsonApiUser(req, res);
  if (!user) {
    return;
  }

  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const now = new Date();
  await expireDirectLanguageExchangeCalls(now);

  if (parsedQuery.data.activeCallId) {
    await touchLearnerDirectLanguageExchangeCall({
      callId: parsedQuery.data.activeCallId,
      learnerId: user.id,
      now,
    });
  }

  const settings = await getUserSettings(user.id);
  const activeCall = await findActiveDirectLanguageExchangeCallForLearner(
    user.id,
    now,
  );

  if (activeCall) {
    res.status(200).json({
      enabled: Boolean(settings.languageExchangeAvailable),
      incomingCall: null,
      activeCall: mapDirectLanguageExchangeCall(activeCall),
    });
    return;
  }

  if (!settings.languageExchangeAvailable) {
    res.status(200).json({
      enabled: false,
      incomingCall: null,
      activeCall: null,
    });
    return;
  }

  const incomingCall =
    await findIncomingDirectLanguageExchangeCallForLearner(user.id, now);

  res.status(200).json({
    enabled: true,
    incomingCall: mapDirectLanguageExchangeCall(incomingCall),
    activeCall: null,
  });
}
