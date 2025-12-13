import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { User } from '@prisma/client';
import type { Role } from '../middleware/authorization';
import type { StringValue } from 'ms';
import { 
  ACCOUNT_LOCKOUT_DURATION_MS,
  getJWTExpiresIn,
  getAccessTokenExpiresIn,
  getRefreshTokenExpiresIn,
  parseJWTExpiration
} from '../constants/auth';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: Role;
  };
}

/**
 * Determines user role from the database
 * Returns the role stored in the user's record, defaults to AUTHOR if not found
 */
export const getUserRole = async (userId: string): Promise<Role> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  
  return user?.role ?? 'AUTHOR';
};

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: getJWTExpiresIn() as StringValue | number,
  });
};

export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: getAccessTokenExpiresIn() as StringValue | number, 
  });
};

export const generateRefreshToken = async (userId: string): Promise<string> => {
  const refreshTokenExpiration = getRefreshTokenExpiresIn();
  const token = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!, {
    expiresIn: refreshTokenExpiration as StringValue | number,
  });

  // Calculate expiration date based on the configured refresh token expiration time
  const expirationMs = parseJWTExpiration(refreshTokenExpiration);
  const expiresAt = new Date(Date.now() + expirationMs);

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
};

export const verifyRefreshToken = async (token: string): Promise<string | null> => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!) as { userId: string };

    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!refreshToken || refreshToken.expiresAt < new Date()) {
      if (refreshToken) {
        await prisma.refreshToken.delete({ where: { token } });
      }
      return null;
    }

    return decoded.userId;
  } catch (error) {
    return null;
  }
};

export const revokeRefreshToken = async (token: string): Promise<void> => {
  await prisma.refreshToken.deleteMany({
    where: { token },
  });
};

export const revokeAllUserRefreshTokens = async (userId: string): Promise<void> => {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
};

export const cleanupExpiredTokens = async (): Promise<void> => {
  await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
};

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, username: true, role: true, deletedAt: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    if (user.deletedAt) {
      res.status(403).json({ error: 'Account has been deactivated' });
      return;
    }

    req.user = { id: user.id, email: user.email, username: user.username, role: user.role };
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }
};

/**
 * Check if account is currently locked
 */
export function isAccountLocked(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false;
  return new Date() < lockedUntil;
}

/**
 * Calculate lockout expiration time
 */
export function calculateLockoutExpiration(): Date {
  return new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS);
}

/**
 * Get seconds until account is unlocked
 */
export function getSecondsUntilUnlock(lockedUntil: Date): number {
  const now = Date.now();
  const unlockTime = lockedUntil.getTime();
  return Math.max(0, Math.ceil((unlockTime - now) / 1000));
}
