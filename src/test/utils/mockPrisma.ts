import { PrismaClient } from '@prisma/client';
import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { Express } from 'express';
import { mockDeep } from 'jest-mock-extended';

/**
 * Extended type for mocked Prisma client that includes the isMocked flag
 */
export type MockedPrismaClient = DeepMockProxy<PrismaClient> & {
  isMocked: true;
};

/**
 * Sets up Prisma mocking for a test file.
 * 
 * IMPORTANT: You must call jest.mock() at the top of your test file BEFORE importing prisma/app.
 * 
 * @param prisma - The mocked prisma instance (imported after jest.mock)
 * @param app - The Express app instance
 * @returns Object containing the typed mocked prisma instance (with isMocked flag) and app
 * 
 * @example
 * ```typescript
 * // At the top of your test file (before imports):
 * jest.mock('../lib/prisma', () => ({
 *   __esModule: true,
 *   prisma: mockDeep<PrismaClient>(),
 * }));
 * 
 * // Import prisma and app AFTER mocks are set up
 * import { prisma } from '../lib/prisma';
 * import app from '../index';
 * 
 * // Then use the helper to set up automatic mock reset:
 * const { prisma: prismaMock, app } = setupPrismaMock(prisma, app);
 * 
 * describe('My API', () => {
 *   // Validate that mocking is properly set up
 *   it('should have mocking properly configured', () => {
 *     expect(prismaMock.isMocked).toBe(true);
 *   });
 * 
 *   it('should work', async () => {
 *     (prismaMock.user.findMany as jest.Mock).mockResolvedValue([]);
 *     // ... test code
 *   });
 * });
 * ```
 */

// Mock the prisma module ONLY for tags tests
// This ensures other tests are not affected
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

export function setupPrismaMock(prisma: any, app: Express) {
  // Cast to mocked type
  const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

  // Add isMocked flag directly to the prisma mock object
  (prismaMock as any).isMocked = true;

  // Reset all mocks before each test
  beforeEach(() => {
    mockReset(prismaMock);
    // Re-add isMocked flag after reset
    (prismaMock as any).isMocked = true;
  });

  return {
    prisma: prismaMock as MockedPrismaClient,
    app,
  };
}

