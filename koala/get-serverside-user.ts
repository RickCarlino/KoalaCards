import { getSession } from "next-auth/react";
import { GetServerSidePropsContext } from "next/types";
import { prismaClient } from "./prisma-client";

export const getServersideUser = async (
  ctx: GetServerSidePropsContext,
) => {
  const session = await getSession(ctx);
  const email = session?.user?.email;
  if (!email) {
    return;
  }
  const dbUser = await prismaClient.user.findUnique({ where: { email } });
  return dbUser ?? undefined;
};
