import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getUserSettings } from "@/koala/auth-helpers";
import { requireDirectPostUser } from "@/koala/language-exchange-direct-api";
import {
  releaseLanguageExchangePresence,
  upsertLanguageExchangePresence,
} from "@/koala/language-exchange-direct-server";

const bodySchema = z.object({
  leaseId: z.string().trim().min(1).max(64),
  isVisible: z.boolean(),
  release: z.boolean().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const user = await requireDirectPostUser(req, res);
  if (!user) {
    return;
  }

  const parsedBody = bodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const settings = await getUserSettings(user.id);
  const enabled = Boolean(settings.languageExchangeAvailable);

  if (parsedBody.data.release || !parsedBody.data.isVisible || !enabled) {
    await releaseLanguageExchangePresence({
      userId: user.id,
      leaseId: parsedBody.data.leaseId,
    });
    res.status(200).json({ enabled });
    return;
  }

  await upsertLanguageExchangePresence({
    userId: user.id,
    leaseId: parsedBody.data.leaseId,
    isVisible: parsedBody.data.isVisible,
  });

  res.status(200).json({ enabled });
}
