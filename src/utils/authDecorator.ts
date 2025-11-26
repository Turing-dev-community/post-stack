import { Response } from 'express';
import { AuthRequest } from './auth';
import { Role } from '../middleware/authorization';

export interface AuthCheckResult {
  authorized: boolean;
  response?: Response;
}

export class AuthChecker {
  static requireAuth(req: AuthRequest, res: Response): AuthCheckResult {
    if (!req.user) {
      return {
        authorized: false,
        response: res.status(401).json({
          error: 'Authentication required',
        }),
      };
    }
    return { authorized: true };
  }

  static requireRole(req: AuthRequest, res: Response, requiredRole: Role): AuthCheckResult {
    const authCheck = this.requireAuth(req, res);
    if (!authCheck.authorized) {
      return authCheck;
    }

    if (req.user!.role !== requiredRole && req.user!.role !== 'ADMIN') {
      return {
        authorized: false,
        response: res.status(403).json({
          error: `${requiredRole === 'ADMIN' ? 'Admin' : requiredRole} access required`,
        }),
      };
    }

    return { authorized: true };
  }

  static requireAdmin(req: AuthRequest, res: Response): AuthCheckResult {
    return this.requireRole(req, res, 'ADMIN');
  }

  static requireAuthor(req: AuthRequest, res: Response): AuthCheckResult {
    return this.requireRole(req, res, 'AUTHOR');
  }

  static requireOwnershipOrAdmin(
    req: AuthRequest,
    res: Response,
    resourceUserId: string
  ): AuthCheckResult {
    const authCheck = this.requireAuth(req, res);
    if (!authCheck.authorized) {
      return authCheck;
    }

    if (req.user!.id !== resourceUserId && req.user!.role !== 'ADMIN') {
      return {
        authorized: false,
        response: res.status(403).json({
          error: 'Not authorized to access this resource',
        }),
      };
    }

    return { authorized: true };
  }
}

export function checkAuth(req: AuthRequest, res: Response): req is AuthRequest & { user: NonNullable<AuthRequest['user']> } {
  const result = AuthChecker.requireAuth(req, res);
  return result.authorized;
}

export function checkAdmin(req: AuthRequest, res: Response): req is AuthRequest & { user: NonNullable<AuthRequest['user']> } {
  const result = AuthChecker.requireAdmin(req, res);
  return result.authorized;
}

export function checkAuthor(req: AuthRequest, res: Response): req is AuthRequest & { user: NonNullable<AuthRequest['user']> } {
  const result = AuthChecker.requireAuthor(req, res);
  return result.authorized;
}

export function checkOwnership(
  req: AuthRequest,
  res: Response,
  resourceUserId: string
): req is AuthRequest & { user: NonNullable<AuthRequest['user']> } {
  const result = AuthChecker.requireOwnershipOrAdmin(req, res, resourceUserId);
  return result.authorized;
}
