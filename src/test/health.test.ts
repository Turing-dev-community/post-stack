import { PrismaClient } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

// Mock prisma before importing it
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Health Check API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status when database is connected', async () => {
      // Mock successful database query
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('healthy');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('version');
      expect(res.body.checks.database.status).toBe('up');
      expect(res.body.checks.database).toHaveProperty('responseTime');
    });

    it('should return unhealthy status when database is down', async () => {
      // Mock database error
      (prismaMock.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const res = await request(app)
        .get('/health')
        .expect(503);

      expect(res.body.status).toBe('unhealthy');
      expect(res.body.checks.database.status).toBe('down');
      expect(res.body.checks.database.error).toBe('Connection refused');
    });

    it('should include all required fields in response', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body).toMatchObject({
        status: expect.any(String),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        checks: {
          database: {
            status: expect.any(String),
          },
        },
      });
    });
  });

  describe('GET /health/live', () => {
    it('should return alive status', async () => {
      const res = await request(app)
        .get('/health/live')
        .expect(200);

      expect(res.body.status).toBe('alive');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should always return 200 regardless of database state', async () => {
      // Even if database is down, liveness should pass
      (prismaMock.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB down'));

      const res = await request(app)
        .get('/health/live')
        .expect(200);

      expect(res.body.status).toBe('alive');
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready status when database is connected', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      const res = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(res.body.status).toBe('ready');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should return not_ready status when database is down', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const res = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(res.body.status).toBe('not_ready');
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Response format validation', () => {
    it('should return database response time as number', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(typeof res.body.checks.database.responseTime).toBe('number');
      expect(res.body.checks.database.responseTime).toBeGreaterThanOrEqual(0);
    });
  });
});

