import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import { asyncHandler } from '../middleware/validation';
import { followUser as followUserService, unfollowUser as unfollowUserService, getFollowers as getFollowersService, getFollowing as getFollowingService } from '../services/usersService';
import { prisma } from '../lib/prisma';

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
  const skip = (page - 1) * limit;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    return res.status(404).json({
      error: 'User not found',
    });
  }

  // Fetch user's posts and comments in parallel
  const [posts, comments, postsCount, commentsCount] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: userId,
        published: true,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.comment.findMany({
      where: {
        userId,
        post: {
          published: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.post.count({
      where: {
        authorId: userId,
        published: true,
      },
    }),
    prisma.comment.count({
      where: {
        userId,
        post: {
          published: true,
        },
      },
    }),
  ]);

  // Transform posts to activity items
  const postActivities = posts.map((post) => ({
    type: 'post' as const,
    id: post.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    published: post.published,
    featured: post.featured,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author,
    category: post.category,
    tags: post.tags.map((postTag: any) => postTag.tag),
    viewCount: post.viewCount,
  }));

  // Transform comments to activity items
  const commentActivities = comments.map((comment) => ({
    type: 'comment' as const,
    id: comment.id,
    content: comment.content,
    postId: comment.postId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: comment.user,
    post: comment.post,
  }));

  // Merge and sort by createdAt (newest first)
  const allActivities = [...postActivities, ...commentActivities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Apply pagination
  const paginatedActivities = allActivities.slice(skip, skip + limit);
  const total = postsCount + commentsCount;

  return res.json({
    activities: paginatedActivities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
