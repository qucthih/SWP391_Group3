import { PrismaClient } from "@prisma/client";

// Đảm bảo chỉ khởi tạo một instance PrismaClient duy nhất (Singleton pattern)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
