import { randomBytes } from "node:crypto";
import { prismaClient } from "@/koala/prisma-client";

export function getStudyReportLink(userId: string) {
  return prismaClient.studyReportLink.findUnique({
    where: { userId },
    select: { token: true },
  });
}

export function saveStudyReportLink(userId: string, regenerate = false) {
  const token = randomBytes(32).toString("hex");
  return prismaClient.studyReportLink.upsert({
    where: { userId },
    create: { userId, token },
    update: regenerate ? { token } : {},
    select: { token: true },
  });
}

export async function disableStudyReportLink(userId: string) {
  await prismaClient.studyReportLink.deleteMany({ where: { userId } });
}

export async function getStudyReportOwner(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }
  const link = await prismaClient.studyReportLink.findUnique({
    where: { token },
    select: { userId: true },
  });
  return link?.userId ?? null;
}
