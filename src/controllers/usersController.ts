import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import { asyncHandler } from '../middleware/validation';
import { UsersService } from '../services/usersService';

export class UsersController {
  private usersService: UsersService;

  constructor() {
    this.usersService = new UsersService();
  }

  followUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const { userId } = req.params;
    const followerId = req.user.id;

    try {
      await this.usersService.followUser(followerId, userId);

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

  unfollowUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const { userId } = req.params;
    const followerId = req.user.id;

    try {
      await this.usersService.unfollowUser(followerId, userId);

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

  getFollowers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await this.usersService.getFollowers(userId, page, limit);

    return res.json({
      followers: result.followers,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  });

  getFollowing = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await this.usersService.getFollowing(userId, page, limit);

    return res.json({
      following: result.following,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  });
}

export const usersController = new UsersController();

