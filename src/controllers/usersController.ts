import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import { asyncHandler } from '../middleware/validation';
import { followUser as followUserService, unfollowUser as unfollowUserService, getFollowers as getFollowersService, getFollowing as getFollowingService, getUserPublicProfile as getUserPublicProfileService, getUserActivity as getUserActivityService, deleteUser as deleteUserService } from '../services/usersService';
import { checkAuth, checkAdmin } from '../utils/authDecorator';
import { ResponseHandler } from '../utils/response';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { prisma } from '../lib/prisma';

export const followUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!checkAuth(req, res)) return;

  const { userId } = req.params;
  const followerId = req.user.id;

  try {
    await followUserService(followerId, userId);

    return res.status(201).json({
      message: 'Successfully followed user',
      followingId: userId,
    });
  } catch (error: any) {
    // Handle specific error cases
    if (error.message === 'Cannot follow yourself') {
      return res.status(400).json({
        error: 'Cannot follow yourself',
      });
    }

    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'User not found',
        message: 'This user account has been deactivated.',
      });
    }

    if (error.message === 'Already following this user') {
      return res.status(400).json({
        error: 'Already following this user',
      });
    }

    // Unknown error
    throw error;
  }
});

export const unfollowUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!checkAuth(req, res)) return;

  const { userId } = req.params;
  const followerId = req.user.id;

  try {
    await unfollowUserService(followerId, userId);

    return res.json({
      message: 'Successfully unfollowed user',
      followingId: userId,
    });
  } catch (error: any) {
    if (error.message === 'Not following this user') {
      return res.status(400).json({
        error: 'Not following this user',
      });
    }

    // Unknown error
    throw error;
  }
});

export const getFollowers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await getFollowersService(userId, page, limit);

  return res.json({
    followers: result.followers,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

export const getFollowing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await getFollowingService(userId, page, limit);

  return res.json({
    following: result.following,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

/**
 * Get user activity feed (posts and comments)
 */
export const getUserActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const result = await getUserActivityService(userId, page, limit);

    return res.json({
      activities: result.activities,
      pagination: result.pagination,
    });
  } catch (error: any) {
    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // Unknown error
    throw error;
  }
});

export const getUserPublicProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  try {
    const profile = await getUserPublicProfileService(userId);
    return res.json(profile);
  } catch (error: any) {
    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'User not found',
        message: 'This user account does not exist or has been deactivated.',
      });
    }
    throw error;
  }
});

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: 'User ID is required',
      message: 'Please provide a userId in the request body',
    });
  }

  try {
    await deleteUserService(userId);

    return res.json({
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'User not found',
        message: 'This user account does not exist.',
      });
    }

    if (error.message === 'User already deleted') {
      return res.status(400).json({
        error: 'User already deleted',
        message: 'This user account has already been deleted.',
      });
    }

    // Unknown error
    throw error;
  }
});

/**
 * Extended User type to include isVerified field
 * This field is handled via mock Prisma in tests
 */
interface UserWithVerification {
  id: string;
  isVerified?: boolean;
}

/**
 * Verify a user (Admin only)
 * Sets the user's isVerified field to true
 */
export const verifyUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!checkAdmin(req, res)) return;

  const responseHandler = new ResponseHandler(res);
  const { userId } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  }) as UserWithVerification | null;

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isVerified: true } as Record<string, unknown>,
  }) as UserWithVerification;

  responseHandler.ok({
    message: 'User verified successfully',
    isVerified: updatedUser.isVerified,
  });
});

/**
 * Unverify a user (Admin only)
 * Sets the user's isVerified field to false
 */
export const unverifyUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!checkAdmin(req, res)) return;

  const responseHandler = new ResponseHandler(res);
  const { userId } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  }) as UserWithVerification | null;

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isVerified: false } as Record<string, unknown>,
  }) as UserWithVerification;

  responseHandler.ok({
    message: 'User unverified successfully',
    isVerified: updatedUser.isVerified,
  });
});
