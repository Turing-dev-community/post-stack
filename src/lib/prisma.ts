import { PrismaClient } from '@prisma/client';
import { queryLoggingMiddleware } from '../middleware/prismaQueryLogger';

// Create a singleton instance of PrismaClient
// This ensures we only have one connection pool across the application
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Add query logging middleware for slow query detection
  client.$use(queryLoggingMiddleware);

  return client;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

