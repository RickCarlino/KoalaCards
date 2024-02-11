import { errorReport } from "@/utils/error-report";
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
  // Update users lastSeen field:
  try {
    await prismaClient.user.update({
      where: { id: "" + userId },
      data: { lastSeen: new Date() },
    });
  } catch (error) {}
  return await prismaClient.userSettings.upsert({
    where: params,
    update: {},
    create: params,
    include: {
      user: true,
    },
  });
};
