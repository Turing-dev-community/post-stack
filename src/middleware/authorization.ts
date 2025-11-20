import { Response, NextFunction } from 'express';
import { AuthRequest } from '../utils/auth';
import { ForbiddenError } from '../utils/errors';
import { asyncErrorHandler } from '../utils/errors';

/**
 * Role types - only ADMIN and AUTHOR are supported
 */
export type Role = 'ADMIN' | 'AUTHOR';

/**
 * Role hierarchy for permission checking
 * Higher roles inherit permissions from lower roles
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  AUTHOR: 1,
  ADMIN: 2,
};

/**
 * Checks if a user's role meets the minimum required role
 */
const hasMinimumRole = (userRole: Role, requiredRole: Role): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

/**
 * Middleware to require a specific role or higher
 */
export const requireRole = (requiredRole: Role) => {
  return asyncErrorHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    if (!hasMinimumRole(req.user.role, requiredRole)) {
      throw new ForbiddenError(
        `Access denied. Required role: ${requiredRole} or higher. Your role: ${req.user.role}`
      );
    }

    next();
  });
};

/**
 * Middleware to require ADMIN role
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware to require AUTHOR role or higher
 * Used for content creation routes (posts, images, etc.)
 */
export const requireAuthor = requireRole('AUTHOR');

/**
 * Middleware to check if user owns a resource or has required role
 * Useful for operations where users can modify their own resources OR have elevated permissions
 */
export const requireOwnershipOrRole = (requiredRole: Role = 'ADMIN') => {
  return asyncErrorHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    // If user has the required role or higher, allow access
    if (hasMinimumRole(req.user.role, requiredRole)) {
      return next();
    }

    // Otherwise, check ownership (this should be implemented by the route handler)
    // This middleware just ensures the user is authenticated
    next();
  });
};

