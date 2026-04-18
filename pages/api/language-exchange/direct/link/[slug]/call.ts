import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { sessionDescriptionSchema } from "@/koala/language-exchange";
import {
  createDirectLanguageExchangeCall,
  expireDirectLanguageExchangeCalls,
  findLanguageExchangeLinkBySlug,
  getLanguageExchangeAvailabilityStatus,
} from "@/koala/language-exchange-direct-server";

const paramsSchema = z.object({
  slug: z.string().trim().min(1).max(64),
});

const bodySchema = z.object({
  offer: sessionDescriptionSchema.refine(
    (value) => value.type === "offer",
    "Expected offer SDP.",
  ),
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

  const parsedParams = paramsSchema.safeParse(req.query);
  const parsedBody = bodySchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const now = new Date();
  await expireDirectLanguageExchangeCalls(now);

  const link = await findLanguageExchangeLinkBySlug(
    parsedParams.data.slug,
  );
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const availability = await getLanguageExchangeAvailabilityStatus({
    userId: link.userId,
    now,
  });

  if (availability !== "available") {
    res.status(409).json({
      error:
        availability === "busy"
          ? "This learner is already on a call."
          : "This learner is not available right now.",
    });
    return;
  }

  try {
    const call = await createDirectLanguageExchangeCall({
      linkId: link.id,
      learnerId: link.userId,
      offer: parsedBody.data.offer,
      now,
    });

    res.status(200).json({
      callId: call.id,
      guestToken: call.guestToken,
      status: call.status,
      createdAt: call.createdAt,
      expiresAt: call.expiresAt,
    });
  } catch (error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        error: "This learner is already on a call.",
      });
      return;
    }

    throw error;
  }
}
