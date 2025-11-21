import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import { asyncHandler } from '../middleware/validation';
import { followUser as followUserService, unfollowUser as unfollowUserService, getFollowers as getFollowersService, getFollowing as getFollowingService, getUserPublicProfile as getUserPublicProfileService, getUserActivity as getUserActivityService} from '../services/usersService';

export const followUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

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
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

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
