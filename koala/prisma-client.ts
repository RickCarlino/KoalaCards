import { PrismaClient } from "@prisma/client";

type PrismaGlobal = typeof globalThis & {
  prismaClient?: PrismaClient;
};

const prismaGlobal = globalThis as PrismaGlobal;

export const prismaClient =
  prismaGlobal.prismaClient ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prismaClient = prismaClient;
}
