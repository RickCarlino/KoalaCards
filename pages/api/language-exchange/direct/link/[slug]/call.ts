import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { directLanguageExchangeSessionDescriptionSchema } from "@/koala/language-exchange-direct";
import { resolveDirectLinkRequest } from "@/koala/language-exchange-direct-api";
import {
  createDirectLanguageExchangeCall,
  getLanguageExchangeAvailabilityStatus,
} from "@/koala/language-exchange-direct-server";

const bodySchema = z.object({
  offer: directLanguageExchangeSessionDescriptionSchema.refine(
    (value) => value.type === "offer",
    "Expected offer SDP.",
  ),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const directLinkRequest = await resolveDirectLinkRequest({
    invalidMessage: "Invalid request",
    method: "POST",
    req,
    res,
  });
  if (!directLinkRequest) {
    return;
  }

  const parsedBody = bodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { link, now } = directLinkRequest;

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
