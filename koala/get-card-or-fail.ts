import { prismaClient } from "@/koala/prisma-client";
import { errorReport } from "./error-report";

export async function getCardOrFail(id: number, userId?: string) {
  const card = await prismaClient.card.findFirst({
    where: {
      id,
      userId: userId || "000",
    },
  });
  if (!card) {
    return errorReport("Card not found");
  }
  return card;
}
