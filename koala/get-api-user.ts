import { User } from "@prisma/client";
import { getServerSession } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";
import { prismaClient } from "@/koala/prisma-client";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export async function getApiUserOrNull(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<User | null> {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) {
    return null;
  }

  return prismaClient.user.findFirst({
    where: { email },
  });
}
