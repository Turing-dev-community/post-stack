import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    };
  };
}

/**
 * Comprehensive health check endpoint that verifies:
 * - Server is running
 * - Database connectivity
 * - Response times
 */
export const getHealth = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  // Check database connectivity
  let dbStatus: 'up' | 'down' = 'down';
  let dbResponseTime: number | undefined;
  let dbError: string | undefined;

  try {
    const dbStart = Date.now();
    // Simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    dbResponseTime = Date.now() - dbStart;
    dbStatus = 'up';
  } catch (error) {
    dbError = error instanceof Error ? error.message : 'Unknown database error';
    dbStatus = 'down';
  }

  // Determine overall health status
  const overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 
    dbStatus === 'up' ? 'healthy' : 'unhealthy';

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: {
        status: dbStatus,
        ...(dbResponseTime !== undefined && { responseTime: dbResponseTime }),
        ...(dbError && { error: dbError }),
      },
    },
  };

  // Return appropriate HTTP status code
  const httpStatus = overallStatus === 'healthy' ? 200 : 503;
  
  res.status(httpStatus).json(response);
};

/**
 * Simple liveness probe - just checks if the server is responding
 * Useful for Kubernetes liveness probes
 */
export const getLiveness = (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Readiness probe - checks if the server is ready to accept traffic
 * Useful for Kubernetes readiness probes
 */
export const getReadiness = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check database is ready
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Service not ready',
    });
  }
};

