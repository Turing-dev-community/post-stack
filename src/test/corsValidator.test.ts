import { validateCorsOrigins, CorsValidationResult } from '../utils/corsValidator';

describe('CORS Validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    // Silence console output during tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should warn when FRONTEND_URL is not set in production', () => {
      delete process.env.FRONTEND_URL;

      // Need to re-import to pick up new env
      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('FRONTEND_URL environment variable is not set');
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should warn when FRONTEND_URL contains localhost in production', () => {
      process.env.FRONTEND_URL = 'http://localhost:3000';

      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result.isValid).toBe(true);
        expect(result.warnings.some((w: string) => w.includes('localhost'))).toBe(true);
      });
    });

    it('should warn when FRONTEND_URL contains 127.0.0.1 in production', () => {
      process.env.FRONTEND_URL = 'http://127.0.0.1:3000';

      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result.isValid).toBe(true);
        expect(result.warnings.some((w: string) => w.includes('localhost'))).toBe(true);
      });
    });

    it('should error when FRONTEND_URL has invalid format (missing protocol)', () => {
      process.env.FRONTEND_URL = 'example.com';

      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Invalid FRONTEND_URL format');
      });
    });

    it('should error when FRONTEND_URL is completely invalid', () => {
      process.env.FRONTEND_URL = 'not-a-valid-url';

      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should pass validation for valid production URL', () => {
      process.env.FRONTEND_URL = 'https://myblog.example.com';

      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });
    });

    it('should pass validation for valid HTTPS URL with path', () => {
      process.env.FRONTEND_URL = 'https://example.com/blog';

      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should provide info message when FRONTEND_URL is not set in development', () => {
      delete process.env.FRONTEND_URL;

      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result.isValid).toBe(true);
        expect(result.warnings.some((w: string) => w.includes('INFO'))).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should not warn for localhost in development', () => {
      process.env.FRONTEND_URL = 'http://localhost:4000';

      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result.isValid).toBe(true);
        // Should not have localhost warning in dev
        expect(result.warnings.some((w: string) => w.includes('localhost') && w.includes('WARNING'))).toBe(false);
      });
    });
  });

  describe('Test Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should skip validation in test environment', () => {
      delete process.env.FRONTEND_URL;

      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('Validation Result Structure', () => {
    it('should return correct result structure', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'https://example.com';

      jest.isolateModules(() => {
        const { validateCorsOrigins: validate } = require('../utils/corsValidator');
        const result: CorsValidationResult = validate(false);

        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('warnings');
        expect(result).toHaveProperty('errors');
        expect(Array.isArray(result.warnings)).toBe(true);
        expect(Array.isArray(result.errors)).toBe(true);
      });
    });
  });
});

