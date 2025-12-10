import pino, { Logger as PinoLogger } from 'pino';
import { LOG_LEVEL, LOG_PRETTY, APP_NAME, LOG_ENABLED } from '../constants/logging';

/**
 * Structured logger using Pino
 * 
 * Features:
 * - JSON output in production for log aggregation
 * - Pretty printing in development for readability
 * - Log levels: fatal, error, warn, info, debug, trace
 * - Child loggers for adding context
 * - Silent mode for tests
 */

// Configure Pino options
const pinoOptions: pino.LoggerOptions = {
  name: APP_NAME,
  level: LOG_ENABLED ? LOG_LEVEL : 'silent',
  // Add timestamp in ISO format
  timestamp: pino.stdTimeFunctions.isoTime,
  // Base context added to all logs
  base: {
    env: process.env.NODE_ENV || 'development',
  },
  // Format error objects properly
  formatters: {
    level: (label) => ({ level: label }),
  },
};

// Add pretty printing for development
const transport = LOG_PRETTY
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

// Create the base logger
const baseLogger: PinoLogger = transport
  ? pino(pinoOptions, pino.transport(transport))
  : pino(pinoOptions);

/**
 * Logger interface matching common logging patterns
 */
export interface Logger {
  fatal: (msg: string, data?: object) => void;
  error: (msg: string, data?: object) => void;
  warn: (msg: string, data?: object) => void;
  info: (msg: string, data?: object) => void;
  debug: (msg: string, data?: object) => void;
  trace: (msg: string, data?: object) => void;
  child: (bindings: object) => Logger;
}

/**
 * Wrap Pino logger to match our interface
 */
const wrapLogger = (pinoInstance: PinoLogger): Logger => ({
  fatal: (msg: string, data?: object) => data ? pinoInstance.fatal(data, msg) : pinoInstance.fatal(msg),
  error: (msg: string, data?: object) => data ? pinoInstance.error(data, msg) : pinoInstance.error(msg),
  warn: (msg: string, data?: object) => data ? pinoInstance.warn(data, msg) : pinoInstance.warn(msg),
  info: (msg: string, data?: object) => data ? pinoInstance.info(data, msg) : pinoInstance.info(msg),
  debug: (msg: string, data?: object) => data ? pinoInstance.debug(data, msg) : pinoInstance.debug(msg),
  trace: (msg: string, data?: object) => data ? pinoInstance.trace(data, msg) : pinoInstance.trace(msg),
  child: (bindings: object) => wrapLogger(pinoInstance.child(bindings)),
});

/**
 * Main application logger
 */
export const logger = wrapLogger(baseLogger);

/**
 * Create a child logger with additional context
 * Useful for adding request IDs, user context, etc.
 * 
 * @example
 * const requestLogger = createChildLogger({ requestId: 'abc123' });
 * requestLogger.info('Processing request');
 */
export const createChildLogger = (bindings: object): Logger => {
  return wrapLogger(baseLogger.child(bindings));
};

/**
 * Pre-configured loggers for common use cases
 */
export const loggers = {
  /** HTTP request/response logging */
  http: wrapLogger(baseLogger.child({ module: 'http' })),
  /** Database operations logging */
  db: wrapLogger(baseLogger.child({ module: 'database' })),
  /** Authentication/authorization logging */
  auth: wrapLogger(baseLogger.child({ module: 'auth' })),
  /** Business logic logging */
  app: wrapLogger(baseLogger.child({ module: 'app' })),
};

export default logger;

