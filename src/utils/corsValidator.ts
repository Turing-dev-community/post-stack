import {
  PRODUCTION_FRONTEND_URL,
  DEFAULT_FRONTEND_URL_DEV,
  URL_PATTERN,
  LOCALHOST_PATTERN,
} from '../constants/cors';
import logger from './logger';

export interface CorsValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validates CORS origin configuration at application startup.
 * - In production: Checks if FRONTEND_URL is set and valid
 * - In development: Provides informational messages about defaults
 * - Returns validation result instead of exiting (for testability)
 */
export const validateCorsOrigins = (exitOnError = true): CorsValidationResult => {
  const result: CorsValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
  };

  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === 'production') {
    // Check if FRONTEND_URL is set
    if (!PRODUCTION_FRONTEND_URL) {
      result.warnings.push(
        '⚠️ WARNING: In production, FRONTEND_URL environment variable is not set. CORS might be misconfigured.'
      );
    } else {
      // Check for localhost in production
      if (LOCALHOST_PATTERN.test(PRODUCTION_FRONTEND_URL)) {
        result.warnings.push(
          `⚠️ WARNING: In production, FRONTEND_URL is set to a localhost address (${PRODUCTION_FRONTEND_URL}). This is usually not intended.`
        );
      }

      // Validate URL format
      if (!URL_PATTERN.test(PRODUCTION_FRONTEND_URL)) {
        result.errors.push(
          `❌ ERROR: Invalid FRONTEND_URL format in production: "${PRODUCTION_FRONTEND_URL}". Must start with http:// or https://`
        );
        result.isValid = false;
      } else {
        // Try to parse as URL for additional validation
        try {
          new URL(PRODUCTION_FRONTEND_URL);
        } catch {
          result.errors.push(
            `❌ ERROR: Invalid FRONTEND_URL format in production: "${PRODUCTION_FRONTEND_URL}"`
          );
          result.isValid = false;
        }
      }
    }
  } else if (nodeEnv === 'development') {
    // Informational message for development
    const currentFrontendUrl = process.env.FRONTEND_URL;
    if (!currentFrontendUrl) {
      result.warnings.push(
        `ℹ️ INFO: FRONTEND_URL not set in development. Using defaults: ${DEFAULT_FRONTEND_URL_DEV}`
      );
    }
  }

  // Log warnings
  result.warnings.forEach((warning) => logger.warn(warning));

  // Log errors
  result.errors.forEach((error) => logger.error(error));

  // Exit if there are critical errors and exitOnError is true
  if (!result.isValid && exitOnError && nodeEnv === 'production') {
    logger.error('CORS configuration is invalid. Server cannot start.');
    process.exit(1);
  }

  return result;
};

