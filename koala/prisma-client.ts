import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/koala/generated/prisma/client";

type PrismaGlobal = { prisma: PrismaClient | undefined };
const globalForPrisma = global as unknown as PrismaGlobal;
const adapter = new PrismaPg({
  connectionString: process.env.POSTGRES_URI,
});
export const prismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}
