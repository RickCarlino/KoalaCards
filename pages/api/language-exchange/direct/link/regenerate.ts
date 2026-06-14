import type { NextApiRequest, NextApiResponse } from "next";
import { requireDirectPostUser } from "@/koala/language-exchange-direct-api";
import { regenerateLanguageExchangeLink } from "@/koala/language-exchange-direct-server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const user = await requireDirectPostUser(req, res);
  if (!user) {
    return;
  }

  const link = await regenerateLanguageExchangeLink(user.id);
  res.status(200).json({ slug: link.slug });
}
