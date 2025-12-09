import { Prisma } from "@prisma/client";
import {
  SLOW_QUERY_THRESHOLD_MS,
  LOG_ALL_QUERIES,
  QUERY_LOGGING_ENABLED,
} from "../constants/queryLogging";

export interface QueryLogEntry {
  model: string | undefined;
  action: string;
  duration: number;
  timestamp: Date;
  params?: string;
  isSlow: boolean;
}

// Store for recent slow queries (useful for monitoring/debugging)
const slowQueryLog: QueryLogEntry[] = [];
const MAX_SLOW_QUERY_LOG_SIZE = 100;

/**
 * Get recent slow queries for monitoring purposes
 */
export const getSlowQueryLog = (): QueryLogEntry[] => {
  return [...slowQueryLog];
};

/**
 * Clear the slow query log
 */
export const clearSlowQueryLog = (): void => {
  slowQueryLog.length = 0;
};

/**
 * Format duration for display
 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

/**
 * Prisma middleware for logging slow database queries
 * Logs queries that exceed the configured threshold
 */
export const queryLoggingMiddleware: Prisma.Middleware = async (
  params,
  next
) => {
  // Skip if logging is disabled
  if (!QUERY_LOGGING_ENABLED) {
    return next(params);
  }

  const startTime = Date.now();

  // Execute the query
  const result = await next(params);

  const duration = Date.now() - startTime;
  const isSlow = duration >= SLOW_QUERY_THRESHOLD_MS;

  // Create log entry
  const logEntry: QueryLogEntry = {
    model: params.model,
    action: params.action,
    duration,
    timestamp: new Date(),
    params: params.args ? JSON.stringify(params.args) : undefined,
    isSlow,
  };

  // Log slow queries
  if (isSlow) {
    console.warn(
      `🐢 SLOW QUERY [${formatDuration(duration)}]: ${params.model}.${
        params.action
      }`,
      {
        threshold: `${SLOW_QUERY_THRESHOLD_MS}ms`,
        duration: `${duration}ms`,
        model: params.model,
        action: params.action,
        params: params.args,
      }
    );

    // Store in slow query log
    slowQueryLog.push(logEntry);

    // Keep log size bounded
    if (slowQueryLog.length > MAX_SLOW_QUERY_LOG_SIZE) {
      slowQueryLog.shift();
    }
  } else if (LOG_ALL_QUERIES) {
    // Log all queries if enabled (development/debugging)
    console.log(
      `📊 QUERY [${formatDuration(duration)}]: ${params.model}.${params.action}`
    );
  }

  return result;
};

/**
 * Get query logging statistics
 */
export const getQueryLoggingStats = () => {
  const slowQueries = slowQueryLog.filter((q) => q.isSlow);
  const totalDuration = slowQueries.reduce((sum, q) => sum + q.duration, 0);

  return {
    slowQueryCount: slowQueries.length,
    averageSlowQueryDuration:
      slowQueries.length > 0
        ? Math.round(totalDuration / slowQueries.length)
        : 0,
    slowestQuery:
      slowQueries.length > 0
        ? slowQueries.reduce((max, q) => (q.duration > max.duration ? q : max))
        : null,
    thresholdMs: SLOW_QUERY_THRESHOLD_MS,
  };
};
