import { prismaClient } from "./prisma-client";

type UserID = number | string | undefined | null;

export const getUserSettingsFromEmail = async (email?: UserID) => {
  if (!email) {
    throw new Error("Missing Email");
  }
  const where = { email: "" + email };
  const id = (await prismaClient.user.findUnique({ where }))?.id;
  return getUserSettings(id);
};

export const getUserSettings = async (userId?: UserID) => {
  if (!userId) {
    throw new Error("Missing User ID");
  }
  const params = { userId: "" + userId };
  return await prismaClient.userSettings.upsert({
    where: params,
    update: {},
    create: params,
    include: {
      user: true,
    },
  });
};
