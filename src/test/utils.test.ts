import { generateToken, hashPassword, comparePassword } from '../utils/auth';
import { generateSlug } from '../utils/slugUtils';

describe('Auth Utilities', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1d';
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
