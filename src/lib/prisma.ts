import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type PrismaClient as PrismaClientType } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientType;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to use Prisma.");
  }

  return new PrismaClient({
    adapter: new PrismaPg(databaseUrl),
  });
}

export function getPrisma() {
  const prisma = globalForPrisma.prisma ?? createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }

  return prisma;
}
