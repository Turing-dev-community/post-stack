import { setupPrismaMock } from './utils/mockPrisma';
import { generateToken, hashPassword, comparePassword, generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/auth';
import { generateSlug } from '../utils/slugUtils';
import { parseJWTExpiration } from '../constants/auth';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import app from '../index';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Auth Utilities', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1d';
    process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '1d';
  });

  it('should have mocking properly configured', () => {
    expect((prismaMock as any).isMocked).toBe(true);
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = 'user-123';
      const token = generateToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, 'test-secret');
      expect(decoded.userId).toBe(userId);
    });

    it('should use default JWT_EXPIRES_IN value', () => {
      const userId = 'user-456';
      
      const token = generateToken(userId);
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      
      expect(decoded.exp).toBeDefined();
      
      const now = Math.floor(Date.now() / 1000);
      const oneDayInSeconds = 24 * 60 * 60;
      const expectedExp = now + oneDayInSeconds;
      
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 5);
    });

    it('should generate tokens with expiration', () => {
      const userId = 'user-789';
      
      const token = generateToken(userId);
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      
      expect(decoded.exp).toBeDefined();
      const now = Math.floor(Date.now() / 1000);
      expect(decoded.exp).toBeGreaterThan(now);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token with default expiration', () => {
      const userId = 'user-access-123';
      delete process.env.ACCESS_TOKEN_EXPIRES_IN; 
      
      const token = generateAccessToken(userId);
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      
      expect(decoded.userId).toBe(userId);
      expect(decoded.exp).toBeDefined();
      
      const now = Math.floor(Date.now() / 1000);
      const fifteenMinutesInSeconds = 15 * 60;
      const expectedExp = now + fifteenMinutesInSeconds;
      
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 5);
    });

    it('should use ACCESS_TOKEN_EXPIRES_IN environment variable', () => {
      const userId = 'user-access-456';
      process.env.ACCESS_TOKEN_EXPIRES_IN = '30m';
      
      const token = generateAccessToken(userId);
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      
      const now = Math.floor(Date.now() / 1000);
      const thirtyMinutesInSeconds = 30 * 60;
      const expectedExp = now + thirtyMinutesInSeconds;
      
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 5);
    });
  });

  describe('generateRefreshToken', () => {
    const testUserId = 'test-user-123';

    it('should generate a refresh token with default expiration', async () => {
      const mockRefreshToken = {
        id: 'token-1',
        token: expect.any(String),
        userId: testUserId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      (prismaMock.refreshToken.create as jest.Mock).mockResolvedValue(mockRefreshToken);

      const token = await generateRefreshToken(testUserId);
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!) as JwtPayload;
      
      expect(decoded.userId).toBe(testUserId);
      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith({
        data: {
          token: expect.any(String),
          userId: testUserId,
          expiresAt: expect.any(Date),
        },
      });

      const createCall = (prismaMock.refreshToken.create as jest.Mock).mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const now = Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000;
      const actualDiff = expiresAt.getTime() - now;
      
      expect(actualDiff).toBeGreaterThanOrEqual(oneDayInMs - 5000);
      expect(actualDiff).toBeLessThanOrEqual(oneDayInMs + 5000);
    });

    it('should store refresh token in database with correct expiration', async () => {
      const mockRefreshToken = {
        id: 'token-2',
        token: expect.any(String),
        userId: testUserId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      (prismaMock.refreshToken.create as jest.Mock).mockResolvedValue(mockRefreshToken);

      await generateRefreshToken(testUserId);
      
      expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith({
        data: {
          token: expect.any(String),
          userId: testUserId,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should correctly calculate expiration for different time formats', async () => {
      const mockRefreshToken = {
        id: 'token-3',
        token: expect.any(String),
        userId: testUserId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      (prismaMock.refreshToken.create as jest.Mock).mockResolvedValue(mockRefreshToken);

      await generateRefreshToken(testUserId);
      
      const createCall = (prismaMock.refreshToken.create as jest.Mock).mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const now = Date.now();
      const actualDiff = expiresAt.getTime() - now;
      
      const expectedMs = 24 * 60 * 60 * 1000;
      
      expect(actualDiff).toBeGreaterThanOrEqual(expectedMs - 5000);
      expect(actualDiff).toBeLessThanOrEqual(expectedMs + 5000);
    });

    it('should handle different expiration formats correctly', async () => {
      const testCases = [
        { env: '2h', expectedMs: 2 * 60 * 60 * 1000 },
        { env: '30m', expectedMs: 30 * 60 * 1000 },
        { env: '3d', expectedMs: 3 * 24 * 60 * 60 * 1000 },
      ];

      for (const testCase of testCases) {
        process.env.REFRESH_TOKEN_EXPIRES_IN = testCase.env;

        const mockToken = {
          id: `token-${testCase.env}`,
          token: expect.any(String),
          userId: testUserId,
          expiresAt: new Date(Date.now() + testCase.expectedMs),
          createdAt: new Date(),
        };

        (prismaMock.refreshToken.create as jest.Mock).mockResolvedValue(mockToken);

        await generateRefreshToken(testUserId);

        const createCall = (prismaMock.refreshToken.create as jest.Mock).mock.calls[0][0];
        const expiresAt = createCall.data.expiresAt as Date;
        const now = Date.now();
        const actualDiff = expiresAt.getTime() - now;

        expect(actualDiff).toBeGreaterThanOrEqual(testCase.expectedMs - 5000);
        expect(actualDiff).toBeLessThanOrEqual(testCase.expectedMs + 5000);

        (prismaMock.refreshToken.create as jest.Mock).mockClear();
      }

      process.env.REFRESH_TOKEN_EXPIRES_IN = '1d';
    });
  });

  describe('parseJWTExpiration', () => {
    it('should parse seconds correctly', () => {
      expect(parseJWTExpiration('60')).toBe(60 * 1000);
      expect(parseJWTExpiration('120s')).toBe(120 * 1000);
    });

    it('should parse minutes correctly', () => {
      expect(parseJWTExpiration('15m')).toBe(15 * 60 * 1000);
      expect(parseJWTExpiration('30m')).toBe(30 * 60 * 1000);
    });

    it('should parse hours correctly', () => {
      expect(parseJWTExpiration('1h')).toBe(60 * 60 * 1000);
      expect(parseJWTExpiration('24h')).toBe(24 * 60 * 60 * 1000);
    });

    it('should parse days correctly', () => {
      expect(parseJWTExpiration('1d')).toBe(24 * 60 * 60 * 1000);
      expect(parseJWTExpiration('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should throw error for invalid format', () => {
      expect(() => parseJWTExpiration('invalid')).toThrow('Invalid JWT expiration format');
      expect(() => parseJWTExpiration('12x')).toThrow('Invalid JWT expiration format');
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testpassword123';
      const hashed = await hashPassword(password);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'testpassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const password = 'testpassword123';
      const hashed = await hashPassword(password);

      const isValid = await comparePassword(password, hashed);
      expect(isValid).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hashed = await hashPassword(password);

      const isValid = await comparePassword(wrongPassword, hashed);
      expect(isValid).toBe(false);
    });
  });

  describe('generateSlug', () => {
    it('should handle multiple spaces', () => {
      const title = 'Multiple    Spaces   Here';
      const slug = generateSlug(title);

      expect(slug).toBe('multiple-spaces-here');
    });

    it('should handle empty string', () => {
      const title = '';
      const slug = generateSlug(title);

      // New version returns a timestamp-based fallback for empty strings
      expect(slug).toMatch(/^post-\d+$/);
    });

    it('should handle numbers and hyphens', () => {
      const title = 'Post 123 - The Best Article';
      const slug = generateSlug(title);

      expect(slug).toBe('post-123-the-best-article');
    });

    it('should handle title ending with exclamation mark', () => {
      const title = 'Hello world!';
      const slug = generateSlug(title);

      expect(slug).toBe('hello-world');
    });

    it('should handle special characters', () => {
      const title = 'Hello@#\" World!$%^&*()';
      const slug = generateSlug(title);

      expect(slug).toBe('hello-world');
    });

    it('should handle commas correctly', () => {
      const title = 'Hello, World';
      const slug = generateSlug(title);

      expect(slug).toBe('hello-world');
    });
  });
});
