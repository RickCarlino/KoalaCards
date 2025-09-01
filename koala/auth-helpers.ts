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
  const params = { userId: "" + userId };
  prismaClient.user
    .update({
      where: { id: "" + userId },
      data: { lastSeen: new Date() },
    })
    .then(
      () => undefined,
      () => undefined,
    ); // intentionally ignore failures for best-effort lastSeen update
  return await prismaClient.userSettings.upsert({
    where: params,
    update: {},
    create: params,
    include: {
      user: true,
    },
  });
};
