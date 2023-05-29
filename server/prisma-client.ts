import { PrismaClient } from "@prisma/client";
type PrismaGlobal = { prisma: PrismaClient | undefined };
const globalForPrisma = global as unknown as PrismaGlobal;
export const prismaClient = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaClient;
