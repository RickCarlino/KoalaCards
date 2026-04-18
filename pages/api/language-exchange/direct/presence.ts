import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getApiUserOrNull } from "@/koala/get-api-user";
import { getUserSettings } from "@/koala/auth-helpers";
import {
  releaseLanguageExchangePresence,
  upsertLanguageExchangePresence,
} from "@/koala/language-exchange-direct-server";

const bodySchema = z.object({
  leaseId: z.string().trim().min(1).max(64),
  isVisible: z.boolean(),
  release: z.boolean().optional(),
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
