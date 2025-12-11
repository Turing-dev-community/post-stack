/**
 * Logging configuration constants
 */

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

// Log level based on environment
export const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 
  (process.env.NODE_ENV === 'production' ? 'info' : 
   process.env.NODE_ENV === 'test' ? 'error' : 'debug');

// Whether to use pretty printing (human-readable format)
export const LOG_PRETTY = process.env.LOG_PRETTY === 'true' || 
  (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test');

// Application name for log context
export const APP_NAME = process.env.APP_NAME || 'post-stack';

// Whether logging is enabled (can disable in tests)
export const LOG_ENABLED = process.env.LOG_ENABLED !== 'false';

