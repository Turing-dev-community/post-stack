import { Response } from 'express';
import { asyncHandler } from '../middleware/validation';
import { AuthRequest } from '../utils/auth';
import { prisma } from '../lib/prisma';

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
