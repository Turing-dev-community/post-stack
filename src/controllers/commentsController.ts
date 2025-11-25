import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import { asyncHandler } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { invalidateCache } from '../middleware/cache';
import { NotFoundError, ForbiddenError, UnauthorizedError } from '../utils/errors';
import { updateCommenterStats, decrementCommenterStats, checkMultipleTopCommenters } from '../services/commenterStatsService';

async function getThreadDepth(commentId: string, depth: number = 0): Promise<number> {
  if (depth >= 5) {
    return depth;
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { parentId: true },
  });

  if (!comment || !comment.parentId) {
    return depth;
  }

  return getThreadDepth(comment.parentId, depth + 1);
}

async function softDeleteReplies(parentId: string): Promise<void> {
  const replies = await prisma.comment.findMany({
    where: {
      parentId: parentId,
      deletedAt: null, 
    },
    select: { id: true },
  });

  for (const reply of replies) {
    await prisma.comment.update({
      where: { id: reply.id },
      data: { deletedAt: new Date() },
    });

    await softDeleteReplies(reply.id);
  }
}

async function getNestedReplies(postId: string, parentId: string, postAuthorId: string, currentDepth: number = 0, likeCountsMap?: Map<string, number>): Promise<any[]> {
  if (currentDepth >= 5) {
    return [];
  }

  const replies = await prisma.comment.findMany({
    where: {
      parentId: parentId,
      postId: postId,
      deletedAt: null, 
      user: {
        deletedAt: null, // Filter out comments from deactivated users
      },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const commenterIds = replies.map((r: any) => r.userId);
  const topCommenterMap = await checkMultipleTopCommenters(commenterIds, postAuthorId);

  const repliesWithNested = await Promise.all(
    replies.map(async (reply: any) => {
      const likeCount = likeCountsMap?.get(reply.id) || 0;
      return {
        id: reply.id,
        content: reply.content,
        postId: reply.postId,
        userId: reply.userId,
        parentId: reply.parentId,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        user: reply.user,
        likeCount,
        isTopCommenter: topCommenterMap.get(reply.userId) || false,
        replies: await getNestedReplies(postId, reply.id, postAuthorId, currentDepth + 1, likeCountsMap),
      };
    })
  );

  return repliesWithNested;
}

export const getCommentsForPost = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { postId } = req.params;

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  if (post.allowComments === false) {
    return res.status(403).json({
      error: 'Comments are disabled for this post',
    });
  }

  const comments = await prisma.comment.findMany({
    where: { 
      postId, 
      parentId: null,
      deletedAt: null, // Filter out soft-deleted comments
      user: {
        deletedAt: null, // Filter out comments from deactivated users
      },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const likeCounts = await prisma.commentLike.groupBy({
    by: ['commentId'],
    where: {
      comment: {
        postId: postId,
      },
    },
    _count: {
      commentId: true,
    },
  });

  const likeCountsMap = new Map<string, number>();
  likeCounts.forEach((item) => {
    likeCountsMap.set(item.commentId, item._count.commentId);
  });

  const commenterIds = comments.map((c: any) => c.userId);
  const topCommenterMap = await checkMultipleTopCommenters(commenterIds, post.authorId);

  const commentsWithReplies = await Promise.all(
    comments.map(async (comment: any) => {
      const likeCount = likeCountsMap.get(comment.id) || 0;
      return {
        id: comment.id,
        content: comment.content,
        postId: comment.postId,
        userId: comment.userId,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        user: comment.user,
        likeCount,
        isTopCommenter: topCommenterMap.get(comment.userId) || false,
        replies: await getNestedReplies(postId, comment.id, post.authorId, 0, likeCountsMap),
      };
    })
  );

  return res.json({
    comments: commentsWithReplies,
  });
});

export const createComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { postId } = req.params;
  const { content } = req.body;

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  if (post.allowComments === false) {
    return res.status(403).json({
      error: 'Comments are disabled for this post',
    });
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      postId,
      userId: req.user.id,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  await updateCommenterStats(req.user.id, post.authorId);

  invalidateCache.invalidatePostCache(post.slug);

  return res.status(201).json({
    message: 'Comment created successfully',
    comment,
  });
});

export const replyToComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { postId, commentId } = req.params;
  const { content } = req.body;

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  const parentComment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!parentComment || parentComment.postId !== postId) {
    return res.status(404).json({
      error: 'Comment not found',
    });
  }

  const threadDepth = await getThreadDepth(commentId);
  if (threadDepth >= 5) {
    return res.status(400).json({
      error: 'Maximum thread depth of 5 levels reached',
    });
  }

  const reply = await prisma.comment.create({
    data: {
      content,
      postId,
      userId: req.user.id,
      parentId: commentId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });


  await updateCommenterStats(req.user.id, post.authorId);

  invalidateCache.invalidatePostCache(post.slug);

  return res.status(201).json({
    message: 'Reply created successfully',
    comment: reply,
  });
});

export const likeComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { postId, commentId } = req.params;

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.postId !== postId) {
    return res.status(404).json({
      error: 'Comment not found',
    });
  }

  const existingLike = await prisma.commentLike.findUnique({
    where: {
      userId_commentId: {
        userId: req.user.id,
        commentId: commentId,
      },
    },
  });

  if (existingLike) {
    return res.status(400).json({
      error: 'You have already liked this comment',
    });
  }

  await prisma.commentLike.create({
    data: {
      userId: req.user.id,
      commentId: commentId,
    },
  });

  const likeCount = await prisma.commentLike.count({
    where: { commentId: commentId },
  });

  invalidateCache.invalidatePostCache(post.slug);

  return res.status(201).json({
    message: 'Comment liked successfully',
    likeCount,
  });
});

export const unlikeComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { postId, commentId } = req.params;

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.postId !== postId) {
    return res.status(404).json({
      error: 'Comment not found',
    });
  }

  const existingLike = await prisma.commentLike.findUnique({
    where: {
      userId_commentId: {
        userId: req.user.id,
        commentId: commentId,
      },
    },
  });

  if (!existingLike) {
    return res.status(400).json({
      error: 'You have not liked this comment',
    });
  }

  await prisma.commentLike.delete({
    where: {
      userId_commentId: {
        userId: req.user.id,
        commentId: commentId,
      },
    },
  });

  const likeCount = await prisma.commentLike.count({
    where: { commentId: commentId },
  });

  invalidateCache.invalidatePostCache(post.slug);

  return res.json({
    message: 'Comment unliked successfully',
    likeCount,
  });
});

export const updateComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const { postId, commentId } = req.params;
  const { content } = req.body;

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new NotFoundError('Post not found');
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.postId !== postId) {
    throw new NotFoundError('Comment not found');
  }

  if (comment.userId !== req.user.id) {
    throw new ForbiddenError('You can only edit your own comments');
  }

  const updatedComment = await prisma.comment.update({
    where: { id: commentId },
    data: { content },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  const likeCount = await prisma.commentLike.count({
    where: { commentId: commentId },
  });

  invalidateCache.invalidatePostCache(post.slug);

  return res.json({
    message: 'Comment updated successfully',
    comment: {
      ...updatedComment,
      likeCount,
    },
  });
});

export const deleteComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const { postId, commentId } = req.params;

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new NotFoundError('Post not found');
  }

  const comment = await prisma.comment.findFirst({
    where: { 
      id: commentId,
      deletedAt: null,
    },
  });

  if (!comment || comment.postId !== postId) {
    throw new NotFoundError('Comment not found');
  }

  if (comment.userId !== req.user.id) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  await decrementCommenterStats(comment.userId, post.authorId);

  await prisma.comment.update({
    where: { id: commentId },
    data: {
      deletedAt: new Date(),
    },
  });

  await softDeleteReplies(commentId);

  invalidateCache.invalidatePostCache(post.slug);

  return res.json({
    message: 'Comment deleted successfully',
  });
});

/**
 * Get recent comments across all posts with pagination
 */
export const getRecentComments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  // Only get top-level comments (no replies) for recent comments
  const comments = await prisma.comment.findMany({
    where: {
      parentId: null, // Only top-level comments
      deletedAt: null, 
      user: {
        deletedAt: null, // Filter out comments from deactivated users
      },
      post: {
        published: true, // Only comments on published posts
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
          authorId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc', // Most recent first
    },
    skip,
    take: limit,
  });

  const postAuthorMap = new Map<string, string>();
  comments.forEach((comment: any) => {
    postAuthorMap.set(comment.userId, comment.post.authorId);
  });

  const topCommenterChecks = await Promise.all(
    Array.from(postAuthorMap.entries()).map(async ([commenterId, postAuthorId]) => {
      const commenterMap = await checkMultipleTopCommenters([commenterId], postAuthorId);
      return { commenterId, isTopCommenter: commenterMap.get(commenterId) || false };
    })
  );

  const topCommenterMap = new Map<string, boolean>();
  topCommenterChecks.forEach(({ commenterId, isTopCommenter }) => {
    topCommenterMap.set(commenterId, isTopCommenter);
  });

  const commentIds = comments.map(c => c.id);
  const likeCounts = await prisma.commentLike.groupBy({
    by: ['commentId'],
    where: {
      commentId: {
        in: commentIds,
      },
    },
    _count: {
      commentId: true,
    },
  });


  const likeCountsMap = new Map<string, number>();
  likeCounts.forEach((item) => {
    likeCountsMap.set(item.commentId, item._count.commentId);
  });

  // Get like counts for each comment
  const commentsWithLikes = comments.map((comment: any) => {
    const likeCount = likeCountsMap.get(comment.id) || 0;
    return {
      id: comment.id,
      content: comment.content,
      postId: comment.postId,
      userId: comment.userId,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: comment.user,
      post: comment.post,
      likeCount,
      isTopCommenter: topCommenterMap.get(comment.userId) || false,
    };
  });

  // Get total count for pagination
  const total = await prisma.comment.count({
    where: {
      parentId: null,
      deletedAt: null, 
      user: {
        deletedAt: null, // Filter out comments from deactivated users
      },
      post: {
        published: true,
      },
    },
  });

  return res.json({
    comments: commentsWithLikes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
