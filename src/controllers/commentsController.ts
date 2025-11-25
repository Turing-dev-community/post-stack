import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import { asyncHandler } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { invalidateCache } from '../middleware/cache';
import { NotFoundError, ForbiddenError, UnauthorizedError } from '../utils/errors';
import { ModerationStatus } from '@prisma/client';
import * as commentReportsService from '../services/commentReportsService';

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

async function getNestedReplies(postId: string, parentId: string, currentDepth: number = 0, userId?: string, isPostAuthor?: boolean): Promise<any[]> {
  if (currentDepth >= 5) {
    return [];
  }

  const whereClause: any = {
    parentId: parentId,
    postId: postId,
    user: {
      deletedAt: null, // Filter out comments from deactivated users
    },
  };

  // Hide comments with HIDDEN status unless viewer is the post author
  if (!isPostAuthor) {
    whereClause.moderationStatus = { not: ModerationStatus.HIDDEN };
  }

  const replies = await prisma.comment.findMany({
    where: whereClause,
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

  const repliesWithNested = await Promise.all(
    replies.map(async (reply: any) => {
      const likeCount = await prisma.commentLike.count({
        where: { commentId: reply.id },
      });
      return {
        id: reply.id,
        content: reply.content,
        postId: reply.postId,
        userId: reply.userId,
        parentId: reply.parentId,
        moderationStatus: reply.moderationStatus,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        user: reply.user,
        likeCount,
        replies: await getNestedReplies(postId, reply.id, currentDepth + 1, userId, isPostAuthor),
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

  // Check if the current user is the post author
  const isPostAuthor = req.user?.id === post.authorId;

  const whereClause: any = {
    postId,
    parentId: null,
    user: {
      deletedAt: null, // Filter out comments from deactivated users
    },
  };

  // Hide comments with HIDDEN status unless viewer is the post author
  if (!isPostAuthor) {
    whereClause.moderationStatus = { not: ModerationStatus.HIDDEN };
  }

  const comments = await prisma.comment.findMany({
    where: whereClause,
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

  const commentsWithReplies = await Promise.all(
    comments.map(async (comment: any) => {
      const likeCount = await prisma.commentLike.count({
        where: { commentId: comment.id },
      });
      return {
        id: comment.id,
        content: comment.content,
        postId: comment.postId,
        userId: comment.userId,
        parentId: comment.parentId,
        moderationStatus: comment.moderationStatus,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        user: comment.user,
        likeCount,
        replies: await getNestedReplies(postId, comment.id, 0, req.user?.id, isPostAuthor),
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

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.postId !== postId) {
    throw new NotFoundError('Comment not found');
  }

  if (comment.userId !== req.user.id) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  await prisma.comment.delete({
    where: { id: commentId },
  });

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
        },
      },
    },
    orderBy: {
      createdAt: 'desc', // Most recent first
    },
    skip,
    take: limit,
  });

  // Get like counts for each comment
  const commentsWithLikes = await Promise.all(
    comments.map(async (comment: any) => {
      const likeCount = await prisma.commentLike.count({
        where: { commentId: comment.id },
      });
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
      };
    })
  );

  // Get total count for pagination
  const total = await prisma.comment.count({
    where: {
      parentId: null,
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


export const reportComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { postId, commentId } = req.params;
  const { reason } = req.body;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.postId !== postId) {
    return res.status(404).json({
      error: 'Comment not found',
    });
  }

  try {
    const report = await commentReportsService.createCommentReport(commentId, req.user.id, reason);
    return res.status(201).json({
      message: 'Comment reported successfully',
      report,
    });
  } catch (e: any) {
    const message = e.message || 'Failed to create report';
    const status = message === 'Comment not found' ? 404 : message === 'You have already reported this comment' ? 409 : 400;
    return res.status(status).json({ error: message });
  }
});


export const moderateComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const { postId, commentId } = req.params;
  const { action } = req.body;

  if (!['approve', 'hide'].includes(action)) {
    return res.status(400).json({
      error: 'Invalid action. Must be "approve" or "hide"',
    });
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new NotFoundError('Post not found');
  }

  if (post.authorId !== req.user.id) {
    throw new ForbiddenError('Only the post author can moderate comments');
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.postId !== postId) {
    throw new NotFoundError('Comment not found');
  }

  const moderationStatus = action === 'hide' ? ModerationStatus.HIDDEN : ModerationStatus.APPROVED;

  const updatedComment = await prisma.comment.update({
    where: { id: commentId },
    data: { moderationStatus },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  invalidateCache.invalidatePostCache(post.slug);

  return res.json({
    message: `Comment ${action === 'hide' ? 'hidden' : 'approved'} successfully`,
    comment: {
      ...updatedComment,
      moderationStatus: updatedComment.moderationStatus,
    },
  });
});

export const getModerationQueue = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const { postId } = req.params;
  const status = req.query.status as string | undefined;

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new NotFoundError('Post not found');
  }

  if (post.authorId !== req.user.id) {
    throw new ForbiddenError('Only the post author can view the moderation queue');
  }

  const whereClause: any = {
    postId,
    user: {
      deletedAt: null,
    },
  };

  if (status && ['PENDING', 'APPROVED', 'HIDDEN'].includes(status)) {
    whereClause.moderationStatus = status;
  }

  const comments = await prisma.comment.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
      reports: {
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const commentsWithLikes = await Promise.all(
    comments.map(async (comment: any) => {
      const likeCount = await prisma.commentLike.count({
        where: { commentId: comment.id },
      });
      return {
        ...comment,
        likeCount,
      };
    })
  );

  return res.json({
    comments: commentsWithLikes,
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
    },
  });
});
