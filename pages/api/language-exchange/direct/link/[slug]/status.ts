import type { NextApiRequest, NextApiResponse } from "next";
import { resolveDirectLinkRequest } from "@/koala/language-exchange-direct-api";
import { getLanguageExchangeAvailabilityStatus } from "@/koala/language-exchange-direct-server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const directLinkRequest = await resolveDirectLinkRequest({
    invalidMessage: "Invalid link",
    method: "GET",
    req,
    res,
  });
  if (!directLinkRequest) {
    return;
  }

  const { link, now } = directLinkRequest;

  const status = await getLanguageExchangeAvailabilityStatus({
    userId: link.userId,
    now,
  });

  res.status(200).json({ status });
}
