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

export const getJWTExpiresIn = (): string => {
  return process.env.JWT_EXPIRES_IN || '7d';
};

export const getAccessTokenExpiresIn = (): string => {
  return process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
};

export const getRefreshTokenExpiresIn = (): string => {
  return process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
};

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';


export const parseJWTExpiration = (expiresIn: string): number => {
  const match = expiresIn.match(/^(\d+)([smhd]?)$/);
  if (!match) {
    throw new Error(`Invalid JWT expiration format: ${expiresIn}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2] || 's';

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
};

