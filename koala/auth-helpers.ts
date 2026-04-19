import { Prisma } from "@prisma/client";
import { errorReport } from "@/koala/error-report";
import { prismaClient } from "./prisma-client";

type UserID = number | string | undefined | null;

export const getUserSettingsFromEmail = async (email?: UserID) => {
  if (!email) {
    return errorReport("Missing Email");
  }
  const where = { email: "" + email };
  const id = (await prismaClient.user.findUnique({ where }))?.id;
  return getUserSettings(id);
};

export const getUserSettings = async (userId?: UserID) => {
  if (!userId) {
    return errorReport("Missing User ID");
  }
  const resolvedUserId = "" + userId;
  const params = { userId: resolvedUserId };
  prismaClient.user
    .update({
      where: { id: resolvedUserId },
      data: { lastSeen: new Date() },
    })
    .then(
      () => undefined,
      () => undefined,
    );

  const include = {
    user: true,
  } satisfies Prisma.UserSettingsInclude;

  const existingSettings = await prismaClient.userSettings.findUnique({
    where: params,
    include,
  });
  if (existingSettings) {
    return existingSettings;
  }

  try {
    return await prismaClient.userSettings.create({
      data: params,
      include,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return await prismaClient.userSettings.findUniqueOrThrow({
        where: params,
        include,
      });
    }

    throw error;
  }
};
