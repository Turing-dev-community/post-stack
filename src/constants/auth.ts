/**
 * Authentication-related configuration constants
 */

/**
 * Maximum number of consecutive failed login attempts before account lockout
 * Can be overridden via MAX_FAILED_LOGIN_ATTEMPTS environment variable
 * Default: 5 attempts
 */
export const MAX_FAILED_LOGIN_ATTEMPTS = parseInt(
  process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5',
  10
);

/**
 * Account lockout duration in milliseconds
 * Can be overridden via ACCOUNT_LOCKOUT_DURATION_MS environment variable
 * Default: 900000 ms (15 minutes)
 */
export const ACCOUNT_LOCKOUT_DURATION_MS = parseInt(
  process.env.ACCOUNT_LOCKOUT_DURATION_MS || '900000',
  10
);

