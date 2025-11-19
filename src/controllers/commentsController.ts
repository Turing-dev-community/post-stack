import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import { asyncHandler } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { invalidateCache } from '../middleware/cache';
import { NotFoundError, ForbiddenError, UnauthorizedError } from '../utils/errors';

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

async function getNestedReplies(postId: string, parentId: string, currentDepth: number = 0): Promise<any[]> {
  if (currentDepth >= 5) {
    return [];
  }

  const replies = await prisma.comment.findMany({
    where: {
      parentId: parentId,
      postId: postId,
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
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        user: reply.user,
        likeCount,
        replies: await getNestedReplies(postId, reply.id, currentDepth + 1),
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

  const comments = await prisma.comment.findMany({
    where: { postId, parentId: null },
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
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        user: comment.user,
        likeCount,
        replies: await getNestedReplies(postId, comment.id, 0),
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
