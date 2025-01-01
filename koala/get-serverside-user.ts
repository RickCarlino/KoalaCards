import { getSession } from "next-auth/react";
import { GetServerSidePropsContext } from "next/types";
import { prismaClient } from "./prisma-client";

export const getServersideUser = async (
  ctx: GetServerSidePropsContext<any, any>,
) => {
  const session = await getSession(ctx);
  const dbUser = await prismaClient.user.findUnique({
    where: { email: session?.user?.email ?? "" + Math.random() },
  });
  if (dbUser) {
    return dbUser;
  }
};
