// Database Query Logging Configuration

// Default slow query threshold in milliseconds (1 second)
export const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 1000;

// Configurable threshold from environment variable
export const SLOW_QUERY_THRESHOLD_MS = process.env.SLOW_QUERY_THRESHOLD_MS
  ? parseInt(process.env.SLOW_QUERY_THRESHOLD_MS, 10)
  : DEFAULT_SLOW_QUERY_THRESHOLD_MS;

// Whether to log all queries (not just slow ones) - useful for debugging
export const LOG_ALL_QUERIES = process.env.LOG_ALL_QUERIES === 'true';

// Whether query logging is enabled
export const QUERY_LOGGING_ENABLED = process.env.DISABLE_QUERY_LOGGING !== 'true';

