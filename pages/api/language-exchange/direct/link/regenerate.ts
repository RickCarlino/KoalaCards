import type { NextApiRequest, NextApiResponse } from "next";
import { getApiUserOrNull } from "@/koala/get-api-user";
import { regenerateLanguageExchangeLink } from "@/koala/language-exchange-direct-server";

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

  const link = await regenerateLanguageExchangeLink(user.id);
  res.status(200).json({ slug: link.slug });
}
