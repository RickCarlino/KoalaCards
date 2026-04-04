import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getUserSettings } from "@/koala/auth-helpers";
import {
  debugLanguageExchange,
  getMatchedRequestExpiry,
  sessionDescriptionSchema,
} from "@/koala/language-exchange";
import {
  expireStaleLanguageExchangeRequests,
  findNextWaitingLanguageExchangeRequest,
  touchLearnerLanguageExchangePresence,
} from "@/koala/language-exchange-server";
import { prismaClient } from "@/koala/prisma-client";
import { procedure } from "@/koala/trpc-procedure";

function parseSessionDescription(value: Prisma.JsonValue | null) {
  if (!value) {
    return null;
  }

  const parsed = sessionDescriptionSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function mapActiveRequest(
  request: {
    id: number;
    status: string;
    createdAt: Date;
    claimedAt: Date | null;
    expiresAt: Date;
    guestOfferSdp: Prisma.JsonValue | null;
    learnerAnswerSdp: Prisma.JsonValue | null;
  } | null,
) {
  if (!request) {
    return null;
  }

  return {
    id: request.id,
    status: request.status,
    createdAt: request.createdAt,
    claimedAt: request.claimedAt,
    expiresAt: request.expiresAt,
    guestOfferSdp: parseSessionDescription(request.guestOfferSdp),
    learnerAnswerSdp: parseSessionDescription(request.learnerAnswerSdp),
  };
}

function mapIncomingRequest(
  request: {
    id: number;
    createdAt: Date;
    expiresAt: Date;
  } | null,
) {
  if (!request) {
    return null;
  }

  return {
    id: request.id,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
  };
}

export const getLanguageExchangeState = procedure
  .input(
    z.object({
      isVisible: z.boolean().default(true),
      activeRequestId: z.number().int().positive().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const now = new Date();
    await expireStaleLanguageExchangeRequests(now);

    const settings = await getUserSettings(userId);
    const enabled = Boolean(settings.languageExchangeAvailable);

    let activeRequest =
      await prismaClient.languageExchangeRequest.findFirst({
        where: {
          claimedByUserId: userId,
          status: "MATCHED",
        },
        orderBy: [{ claimedAt: "desc" }],
        select: {
          id: true,
          status: true,
          createdAt: true,
          claimedAt: true,
          expiresAt: true,
          guestOfferSdp: true,
          learnerAnswerSdp: true,
        },
      });

    if (enabled && input.isVisible) {
      const activeRequestId = activeRequest?.id;

      await touchLearnerLanguageExchangePresence({
        userId,
        requestId:
          activeRequestId === input.activeRequestId
            ? activeRequestId
            : null,
        now,
      });

      if (activeRequest && activeRequest.id === input.activeRequestId) {
        activeRequest = {
          ...activeRequest,
          expiresAt: getMatchedRequestExpiry(now),
        };
      }
    }

    if (!enabled) {
      debugLanguageExchange("learner.state", {
        userId,
        enabled,
        isVisible: input.isVisible,
        requestedActiveRequestId: input.activeRequestId ?? null,
        activeRequestId: activeRequest?.id ?? null,
        incomingRequestId: null,
      });
      return {
        enabled: false,
        incomingRequest: null,
        activeRequest: mapActiveRequest(activeRequest),
      };
    }

    if (activeRequest) {
      debugLanguageExchange("learner.state", {
        userId,
        enabled,
        isVisible: input.isVisible,
        requestedActiveRequestId: input.activeRequestId ?? null,
        activeRequestId: activeRequest.id,
        hasGuestOffer: Boolean(activeRequest.guestOfferSdp),
        hasLearnerAnswer: Boolean(activeRequest.learnerAnswerSdp),
        incomingRequestId: null,
      });
      return {
        enabled: true,
        incomingRequest: null,
        activeRequest: mapActiveRequest(activeRequest),
      };
    }

    const incomingRequest =
      await findNextWaitingLanguageExchangeRequest(now);

    debugLanguageExchange("learner.state", {
      userId,
      enabled,
      isVisible: input.isVisible,
      requestedActiveRequestId: input.activeRequestId ?? null,
      activeRequestId: null,
      incomingRequestId: incomingRequest?.id ?? null,
    });

    return {
      enabled: true,
      incomingRequest: mapIncomingRequest(incomingRequest),
      activeRequest: null,
    };
  });

export const answerLanguageExchangeRequest = procedure
  .input(
    z.object({
      requestId: z.number().int().positive(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const settings = await getUserSettings(userId);
    if (!settings.languageExchangeAvailable) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Turn on language exchange availability first.",
      });
    }

    const now = new Date();
    await expireStaleLanguageExchangeRequests(now);

    const claimed = await prismaClient.languageExchangeRequest.updateMany({
      where: {
        id: input.requestId,
        status: "WAITING",
        claimedByUserId: null,
        expiresAt: { gte: now },
      },
      data: {
        status: "MATCHED",
        claimedByUserId: userId,
        claimedAt: now,
        learnerHeartbeatAt: now,
        expiresAt: getMatchedRequestExpiry(now),
      },
    });

    if (claimed.count !== 1) {
      debugLanguageExchange("learner.answer.conflict", {
        userId,
        requestId: input.requestId,
      });
      throw new TRPCError({
        code: "CONFLICT",
        message: "Another learner answered first.",
      });
    }

    await touchLearnerLanguageExchangePresence({
      userId,
      requestId: input.requestId,
      now,
    });

    const request =
      await prismaClient.languageExchangeRequest.findUniqueOrThrow({
        where: { id: input.requestId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          claimedAt: true,
          expiresAt: true,
          guestOfferSdp: true,
          learnerAnswerSdp: true,
        },
      });

    debugLanguageExchange("learner.answer.claimed", {
      userId,
      requestId: input.requestId,
    });

    return {
      request: mapActiveRequest(request),
    };
  });

export const submitLanguageExchangeAnswer = procedure
  .input(
    z.object({
      requestId: z.number().int().positive(),
      answer: sessionDescriptionSchema.refine(
        (value) => value.type === "answer",
        "Expected answer SDP.",
      ),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const now = new Date();
    const updated = await prismaClient.languageExchangeRequest.updateMany({
      where: {
        id: input.requestId,
        claimedByUserId: userId,
        status: "MATCHED",
      },
      data: {
        learnerAnswerSdp: input.answer,
        learnerHeartbeatAt: now,
        expiresAt: getMatchedRequestExpiry(now),
      },
    });

    if (updated.count !== 1) {
      debugLanguageExchange("learner.answer.submit-missing", {
        userId,
        requestId: input.requestId,
      });
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Call no longer available.",
      });
    }

    debugLanguageExchange("learner.answer.submitted", {
      userId,
      requestId: input.requestId,
      answerLength: input.answer.sdp.length,
    });

    return { ok: true };
  });

export const endLanguageExchangeRequest = procedure
  .input(
    z.object({
      requestId: z.number().int().positive(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const now = new Date();
    const ended = await prismaClient.languageExchangeRequest.updateMany({
      where: {
        id: input.requestId,
        claimedByUserId: userId,
        status: "MATCHED",
      },
      data: {
        status: "ENDED",
        endedAt: now,
      },
    });

    if (ended.count !== 1) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Call already ended.",
      });
    }

    return { ok: true };
  });
