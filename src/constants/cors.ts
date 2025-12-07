// CORS Configuration Constants

// Default frontend URLs for different environments
export const DEFAULT_FRONTEND_URLS_DEV = ['http://localhost:3000', 'http://localhost:3001'];
export const DEFAULT_FRONTEND_URL_DEV = 'http://localhost:3000';

// Production frontend URL from environment
export const PRODUCTION_FRONTEND_URL = process.env.FRONTEND_URL;

// URL validation patterns
export const URL_PATTERN = /^https?:\/\/.+/;
export const LOCALHOST_PATTERN = /localhost|127\.0\.0\.1/i;

