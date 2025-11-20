import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { User } from '@prisma/client';
import type { Role } from '../middleware/authorization';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: Role;
  };
}

/**
 * Determines user role based on user ID and email
 * Checks against admin lists from environment variables, defaults to AUTHOR
 * Reads environment variables at call time to allow test configuration
 */
export const getUserRole = async (userId: string, email: string): Promise<Role> => {
  // Read admin lists from environment at call time (not module load time)
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()).filter(Boolean) || [];
  const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [];
  
  // Check if user is in admin list
  if (adminEmails.includes(email) || adminUserIds.includes(userId)) {
    return 'ADMIN';
  }
  
  // Default to AUTHOR
  return 'AUTHOR';
};

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: '7d',
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
      select: { id: true, email: true, username: true, deletedAt: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    if (user.deletedAt) {
      res.status(403).json({ error: 'Account has been deactivated' });
      return;
    }

    // Determine user role
    const role = await getUserRole(user.id, user.email);

    req.user = { id: user.id, email: user.email, username: user.username, role };
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }
};

export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[^a-z0-9 -]/g, '')
    .trim();
};