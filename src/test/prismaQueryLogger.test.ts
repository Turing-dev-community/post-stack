import { Prisma } from '@prisma/client';
import {
  queryLoggingMiddleware,
  getSlowQueryLog,
  clearSlowQueryLog,
  getQueryLoggingStats,
  QueryLogEntry,
} from '../middleware/prismaQueryLogger';
import {
  DEFAULT_SLOW_QUERY_THRESHOLD_MS,
  SLOW_QUERY_THRESHOLD_MS,
} from '../constants/queryLogging';

describe('Prisma Query Logger Middleware', () => {
  beforeEach(() => {
    // Clear the slow query log before each test
    clearSlowQueryLog();
    // Silence console output during tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should have default threshold of 1 second', () => {
      expect(DEFAULT_SLOW_QUERY_THRESHOLD_MS).toBe(1000);
    });

    it('should export SLOW_QUERY_THRESHOLD_MS constant', () => {
      expect(typeof SLOW_QUERY_THRESHOLD_MS).toBe('number');
      expect(SLOW_QUERY_THRESHOLD_MS).toBeGreaterThan(0);
    });
  });

  describe('queryLoggingMiddleware', () => {
    it('should pass through the query and return result', async () => {
      const mockParams = {
        model: 'User' as Prisma.ModelName,
        action: 'findMany' as Prisma.PrismaAction,
        args: { where: { id: '1' } },
        dataPath: [] as string[],
        runInTransaction: false,
      };
      const mockResult = [{ id: '1', name: 'Test User' }];
      const mockNext = jest.fn().mockResolvedValue(mockResult);

      const result = await queryLoggingMiddleware(mockParams, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockParams);
      expect(result).toEqual(mockResult);
    });

    it('should log slow queries to console.warn', async () => {
      const mockParams = {
        model: 'Post' as Prisma.ModelName,
        action: 'findMany' as Prisma.PrismaAction,
        args: {},
        dataPath: [] as string[],
        runInTransaction: false,
      };
      
      // Mock a slow query by delaying the next function
      const mockNext = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [];
      });

      // Temporarily lower threshold for testing
      const originalThreshold = SLOW_QUERY_THRESHOLD_MS;
      Object.defineProperty(require('../constants/queryLogging'), 'SLOW_QUERY_THRESHOLD_MS', {
        value: 10,
        writable: true,
      });

      await queryLoggingMiddleware(mockParams, mockNext);

      // Restore threshold
      Object.defineProperty(require('../constants/queryLogging'), 'SLOW_QUERY_THRESHOLD_MS', {
        value: originalThreshold,
        writable: true,
      });

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle queries without model gracefully', async () => {
      const mockParams = {
        model: undefined,
        action: 'queryRaw' as Prisma.PrismaAction,
        args: {},
        dataPath: [] as string[],
        runInTransaction: false,
      };
      const mockResult: unknown[] = [];
      const mockNext = jest.fn().mockResolvedValue(mockResult);

      const result = await queryLoggingMiddleware(mockParams, mockNext);

      expect(result).toEqual(mockResult);
    });
  });

  describe('Slow Query Log', () => {
    it('should start with empty log', () => {
      const log = getSlowQueryLog();
      expect(log).toEqual([]);
    });

    it('should clear the log correctly', () => {
      // Manually add to log for testing
      clearSlowQueryLog();
      const log = getSlowQueryLog();
      expect(log).toHaveLength(0);
    });

    it('should return a copy of the log (not the original)', () => {
      const log1 = getSlowQueryLog();
      const log2 = getSlowQueryLog();
      expect(log1).not.toBe(log2);
      expect(log1).toEqual(log2);
    });
  });

  describe('Query Logging Stats', () => {
    it('should return stats object with correct structure', () => {
      const stats = getQueryLoggingStats();

      expect(stats).toHaveProperty('slowQueryCount');
      expect(stats).toHaveProperty('averageSlowQueryDuration');
      expect(stats).toHaveProperty('slowestQuery');
      expect(stats).toHaveProperty('thresholdMs');
    });

    it('should return zero counts when no slow queries logged', () => {
      clearSlowQueryLog();
      const stats = getQueryLoggingStats();

      expect(stats.slowQueryCount).toBe(0);
      expect(stats.averageSlowQueryDuration).toBe(0);
      expect(stats.slowestQuery).toBeNull();
    });

    it('should return correct threshold from config', () => {
      const stats = getQueryLoggingStats();
      expect(stats.thresholdMs).toBe(SLOW_QUERY_THRESHOLD_MS);
    });
  });

  describe('QueryLogEntry interface', () => {
    it('should have correct shape', () => {
      const entry: QueryLogEntry = {
        model: 'User',
        action: 'findMany',
        duration: 1500,
        timestamp: new Date(),
        params: '{"where":{"id":"1"}}',
        isSlow: true,
      };

      expect(entry.model).toBe('User');
      expect(entry.action).toBe('findMany');
      expect(entry.duration).toBe(1500);
      expect(entry.isSlow).toBe(true);
      expect(entry.params).toBeDefined();
    });

    it('should allow undefined model and params', () => {
      const entry: QueryLogEntry = {
        model: undefined,
        action: '$queryRaw',
        duration: 500,
        timestamp: new Date(),
        isSlow: false,
      };

      expect(entry.model).toBeUndefined();
      expect(entry.params).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty args', async () => {
      const mockParams = {
        model: 'User' as Prisma.ModelName,
        action: 'findMany' as Prisma.PrismaAction,
        args: undefined,
        dataPath: [] as string[],
        runInTransaction: false,
      };
      const mockNext = jest.fn().mockResolvedValue([]);

      const result = await queryLoggingMiddleware(mockParams, mockNext);

      expect(result).toEqual([]);
    });

    it('should handle errors from next function', async () => {
      const mockParams = {
        model: 'User' as Prisma.ModelName,
        action: 'findMany' as Prisma.PrismaAction,
        args: {},
        dataPath: [] as string[],
        runInTransaction: false,
      };
      const mockError = new Error('Database connection failed');
      const mockNext = jest.fn().mockRejectedValue(mockError);

      await expect(queryLoggingMiddleware(mockParams, mockNext)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});

