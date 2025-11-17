import { Response } from 'express';
import { asyncHandler } from '../middleware/validation';
import { AuthRequest, comparePassword, generateToken, hashPassword } from '../utils/auth';
import { prisma } from '../lib/prisma';

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
    select: { id: true, email: true, username: true, createdAt: true },
  });

  const token = generateToken(user.id);
  return res.status(201).json({ message: 'User created successfully', user, token });
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const userAny = user as any;
  if (userAny && userAny.deletedAt) {
    return res.status(403).json({
      error: 'Account has been deactivated',
      message:
        'This account has been deactivated. Please contact support if you believe this is an error.',
    });
  }

  const isPasswordValid = await comparePassword(password, (user as any).password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user.id);
  return res.json({
    message: 'Login successful',
    user: { id: (user as any).id, email: (user as any).email, username: (user as any).username },
    token,
  });
});

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      profilePicture: true,
      about: true,
      createdAt: true,
      _count: { select: { posts: true } },
    },
  });

  const followerCount = await prisma.follow.count({ where: { followingId: req.user.id } });
  const followingCount = await prisma.follow.count({ where: { followerId: req.user.id } });

  return res.json({ user: { ...user, followerCount, followingCount } });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { profilePicture, about } = req.body;
  const updateData: { profilePicture?: string | null; about?: string | null } = {};
  if (profilePicture !== undefined) updateData.profilePicture = profilePicture || null;
  if (about !== undefined) updateData.about = about || null;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: updateData,
    select: {
      id: true,
      email: true,
      username: true,
      profilePicture: true,
      about: true,
      createdAt: true,
      _count: { select: { posts: true } },
    },
  });

  const followerCount = await prisma.follow.count({ where: { followingId: req.user.id } });
  const followingCount = await prisma.follow.count({ where: { followerId: req.user.id } });

  return res.json({
    message: 'Profile updated successfully',
    user: { ...user, followerCount, followingCount },
  });
});

export const deactivateAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = (await prisma.user.findUnique({ where: { id: req.user.id } })) as any;

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user && user.deletedAt) {
    return res.status(400).json({
      error: 'Account already deactivated',
      message: 'This account has already been deactivated.',
    });
  }

  await prisma.user.update({ where: { id: req.user.id }, data: { deletedAt: new Date() } as any });

  return res.json({
    message: 'Account deactivated successfully',
    note:
      'Your account has been deactivated. You will not be able to log in or access your account.',
  });
});
