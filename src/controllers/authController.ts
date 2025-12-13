import { Response } from 'express';
import { asyncHandler } from '../middleware/validation';
import {
  AuthRequest, comparePassword, generateAccessToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens, hashPassword, isAccountLocked,
  calculateLockoutExpiration,
} from '../utils/auth';
import { prisma } from '../lib/prisma';
import type { User } from '@prisma/client';
import { MAX_FAILED_LOGIN_ATTEMPTS } from '../constants/auth';
import { AccountLockedError } from '../utils/errors';

export const signup = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, username, password } = req.body;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existingUser) {
    return res.status(400).json({
      error: 'User already exists',
      message: existingUser.email === email ? 'Email already registered' : 'Username already taken',
    });
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, username, password: hashedPassword },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);
  return res.status(201).json({
    message: 'User created successfully',
    user,
    accessToken,
    refreshToken
  });
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  const user: User | null = await prisma.user.findUnique({ where: { email } });

  // If user doesn't exist, return generic error (don't reveal email existence)
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check if account is deactivated (check before lockout)
  if (user.deletedAt) {
    return res.status(403).json({
      error: 'Account has been deactivated',
      message:
        'This account has been deactivated. Please contact support if you believe this is an error.',
    });
  }

  // Check if lockout has expired and unlock if needed
  if (user.lockedUntil && new Date() >= user.lockedUntil) {
    // Lockout expired, unlock the account
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
    });
    user.lockedUntil = null;
    user.failedLoginAttempts = 0;
  }

  // Check if account is currently locked
  if (isAccountLocked(user.lockedUntil) && user.lockedUntil) {
    throw new AccountLockedError(user.lockedUntil);
  }

  // Validate password
  const isPasswordValid = await comparePassword(password, user.password);

  // Handle failed login
  if (!isPasswordValid) {
    const newAttempts = (user.failedLoginAttempts || 0) + 1;
    const shouldLock = newAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newAttempts,
        lockedUntil: shouldLock ? calculateLockoutExpiration() : user.lockedUntil,
      },
    });

    // Return generic error (don't reveal lockout status on failed attempt)
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Successful login - reset failed attempts and unlock account
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);
  return res.json({
    message: 'Login successful',
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
    accessToken,
    refreshToken,
  });
});


export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { currentPassword, newPassword } = req.body;

  const user: User | null = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.deletedAt) {
    return res.status(403).json({
      error: 'Account has been deactivated',
      message: 'This account has been deactivated. Please contact support if you believe this is an error.',
    });
  }

  const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    return res.status(401).json({
      error: 'Current password is incorrect',
    });
  }

  const hashedNewPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { password: hashedNewPassword },
  });

  return res.json({
    message: 'Password changed successfully',
  });
});

export const reactivateAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  const user: User | null = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check if account is actually deactivated
  if (!user.deletedAt) {
    return res.status(400).json({
      error: 'Account is already active',
      message: 'This account is already active. You can log in normally.',
    });
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Reactivate account
  await prisma.user.update({
    where: { id: user.id },
    data: { deletedAt: null },
  });

  // Generate new tokens
  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  return res.json({
    message: 'Account reactivated successfully',
    user: { id: user.id, email: user.email, username: user.username },
    accessToken,
    refreshToken,
  });
});

export const deactivateAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user: User | null = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.deletedAt) {
    return res.status(400).json({
      error: 'Account already deactivated',
      message: 'This account has already been deactivated.',
    });
  }

  await prisma.user.update({ where: { id: req.user.id }, data: { deletedAt: new Date() } });

  return res.json({
    message: 'Account deactivated successfully',
    note:
      'Your account has been deactivated. You will not be able to log in or access your account.',
  });
});

export const refreshAccessToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  const userId = await verifyRefreshToken(refreshToken);

  if (!userId) {
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, deletedAt: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.deletedAt) {
    return res.status(403).json({ error: 'Account has been deactivated' });
  }

  const accessToken = generateAccessToken(userId);

  return res.json({
    message: 'Access token refreshed successfully',
    accessToken,
  });
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  await revokeRefreshToken(refreshToken);

  return res.json({
    message: 'Logged out successfully',
  });
});

export const logoutAll = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  await revokeAllUserRefreshTokens(req.user.id);

  return res.json({
    message: 'Logged out from all devices successfully',
  });
});
