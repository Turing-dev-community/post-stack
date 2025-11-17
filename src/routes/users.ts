import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../utils/auth';
import { asyncHandler } from '../middleware/validation';
import { AuthRequest } from '../utils/auth';

const router = Router();
const prisma = new PrismaClient();

router.post('/:userId/follow', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { userId } = req.params;
  const followerId = req.user.id;

  if (userId === followerId) {
    return res.status(400).json({
      error: 'Cannot follow yourself',
    });
  }

  const userToFollow = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!userToFollow) {
    return res.status(404).json({
      error: 'User not found',
    });
  }

  // Check if user account is deactivated
  if (userToFollow.deletedAt) {
    return res.status(404).json({
      error: 'User not found',
      message: 'This user account has been deactivated.',
    });
  }

  const existingFollow = await prisma.follow.findFirst({
    where: {
      followerId,
      followingId: userId,
    },
  });

  if (existingFollow) {
    return res.status(400).json({
      error: 'Already following this user',
    });
  }

  await prisma.follow.create({
    data: {
      followerId,
      followingId: userId,
    },
  });

  return res.status(201).json({
    message: 'Successfully followed user',
    followingId: userId,
  });
}));


router.delete('/:userId/follow', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { userId } = req.params;
  const followerId = req.user.id;

  const existingFollow = await prisma.follow.findFirst({
    where: {
      followerId,
      followingId: userId,
    },
  });

  if (!existingFollow) {
    return res.status(400).json({
      error: 'Not following this user',
    });
  }

  await prisma.follow.delete({
    where: {
      id: existingFollow.id,
    },
  });

  return res.json({
    message: 'Successfully unfollowed user',
    followingId: userId,
  });
}));

router.get('/:userId/followers', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [followers, total] = await Promise.all([
    prisma.follow.findMany({
      where: { followingId: userId },
      skip,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        follower: {
          select: {
            id: true,
            username: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.follow.count({
      where: { followingId: userId },
    }),
  ]);

  return res.json({
    followers: followers.map((f: any) => ({
      id: f.follower.id,
      username: f.follower.username,
      createdAt: f.createdAt,
    })),
    total,
    page,
    limit,
  });
}));

router.get('/:userId/following', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [following, total] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId },
      skip,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        following: {
          select: {
            id: true,
            username: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.follow.count({
      where: { followerId: userId },
    }),
  ]);

  return res.json({
    following: following.map((f: any) => ({
      id: f.following.id,
      username: f.following.username,
      createdAt: f.createdAt,
    })),
    total,
    page,
    limit,
  });
}));

export default router;

