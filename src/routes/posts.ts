import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, generateSlug } from '../utils/auth';
import { validatePost, validateComment } from '../middleware/validators';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { AuthRequest } from '../utils/auth';
import { cacheMiddleware, invalidateCache } from '../middleware/cache';
import { CACHE_CONFIG } from '../constants/cache';

const router = Router();
const prisma = new PrismaClient();

router.get('/', cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const titleQuery = req.query.title as string;
  const authorIdQuery = req.query.authorId as string;
  const categoryIdQuery = req.query.categoryId as string;
  const sortBy = (req.query.sortBy as string) || 'createdAt';
  const sortOrder = (req.query.sortOrder as string) || 'desc';
  const skip = (page - 1) * limit;

  // Validate title query
  if (titleQuery !== undefined && (!titleQuery || titleQuery.trim().length === 0)) {
    return res.status(400).json({
      error: 'Title search query cannot be empty',
    });
  }

  // Validate sort fields
  const validSortFields = ['createdAt', 'updatedAt', 'title'];
  if (!validSortFields.includes(sortBy)) {
    return res.status(400).json({
      error: `Invalid sort field. Must be one of: ${validSortFields.join(', ')}`,
    });
  }

  // Validate sort order
  const validSortOrders = ['asc', 'desc'];
  if (!validSortOrders.includes(sortOrder.toLowerCase())) {
    return res.status(400).json({
      error: `Invalid sort order. Must be one of: ${validSortOrders.join(', ')}`,
    });
  }

  // Build where clause
  const whereClause: any = { published: true };

  if (titleQuery && titleQuery.trim()) {
    whereClause.title = {
      contains: titleQuery.trim(),
      mode: 'insensitive'
    };
  }

  if (authorIdQuery) {
    whereClause.authorId = authorIdQuery;
  }

  if (categoryIdQuery) {
    whereClause.categoryId = categoryIdQuery;
  }

  // Build order by clause - featured posts first, then apply other sort params
  const orderBy: any[] = [
    { featured: 'desc' }, // Featured posts first
    { [sortBy]: sortOrder.toLowerCase() as 'asc' | 'desc' }, // Then apply user's sort preference
  ];

  const posts = await prisma.post.findMany({
    where: whereClause,
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
    orderBy,
    skip,
    take: limit,
  });

  // Get like counts for each post
  const postsWithLikes = await Promise.all(
    posts.map(async (post) => {
      const likeCount = await prisma.postLike.count({
        where: { postId: post.id },
      });
      return {
        ...post,
        likeCount,
        tags: post.tags.map((postTag: any) => postTag.tag),
      };
    })
  );

  const total = await prisma.post.count({
    where: whereClause,
  });

  return res.json({
    posts: postsWithLikes,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Get trending posts (published in last 30 days)
router.get('/trending', cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const whereClause: any = {
    published: true,
    createdAt: {
      gte: thirtyDaysAgo,
    },
  };

  const posts = await prisma.post.findMany({
    where: whereClause,
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
    orderBy: [
      { viewCount: 'desc' },
    ],
    skip,
    take: limit,
  });

  const total = await prisma.post.count({
    where: whereClause,
  });

  return res.json({
    posts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Get all posts for authenticated user (including unpublished)
router.get('/my-posts', authenticateToken, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const posts = await prisma.post.findMany({
    where: { authorId: req.user.id },
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
    skip,
    take: limit,
  });

  // Get like counts for each post
  const postsWithLikes = await Promise.all(
    posts.map(async (post) => {
      const likeCount = await prisma.postLike.count({
        where: { postId: post.id },
      });
      return {
        ...post,
        likeCount,
        tags: post.tags.map((postTag: any) => postTag.tag),
      };
    })
  );

  const total = await prisma.post.count({
    where: { authorId: req.user.id },
  });

  return res.json({
    posts: postsWithLikes,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Get saved posts for authenticated user
router.get('/saved', authenticateToken, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const savedPosts = await prisma.savedPost.findMany({
    where: { userId: req.user.id },
    include: {
      post: {
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
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  // Get like counts for each post
  const postsWithLikes = await Promise.all(
    savedPosts.map(async (savedPost) => {
      const likeCount = await prisma.postLike.count({
        where: { postId: savedPost.post.id },
      });
      return {
        ...savedPost.post,
        likeCount,
        savedAt: savedPost.createdAt,
        tags: savedPost.post.tags.map((postTag: any) => postTag.tag),
      };
    })
  );

  const total = await prisma.savedPost.count({
    where: { userId: req.user.id },
  });

  return res.json({
    posts: postsWithLikes,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Helper function to calculate thread depth
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

// Get comments for a post
router.get('/:postId/comments', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { postId } = req.params;

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  // Recursively get nested replies
  async function getNestedReplies(parentId: string, currentDepth: number = 0): Promise<any[]> {
    if (currentDepth >= 5) {
      return [];
    }

    const replies = await prisma.comment.findMany({
      where: {
        parentId: parentId,
        postId: postId  // Ensure replies belong to the same post
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
          replies: await getNestedReplies(reply.id, currentDepth + 1),
        };
      })
    );

    return repliesWithNested;
  }

  // Get all top-level comments (no parent)
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

  // Add nested replies to top-level comments
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
        replies: await getNestedReplies(comment.id, 0),
      };
    })
  );

  return res.json({
    comments: commentsWithReplies,
  });
}));

// Create a comment on a post
router.post('/:postId/comments', authenticateToken, validateComment, handleValidationErrors, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { postId } = req.params;
  const { content } = req.body;

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  // Create the comment
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
}));

// Reply to a comment
router.post('/:postId/comments/:commentId/reply', authenticateToken, validateComment, handleValidationErrors, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { postId, commentId } = req.params;
  const { content } = req.body;

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  // Check if parent comment exists and belongs to the post
  const parentComment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!parentComment || parentComment.postId !== postId) {
    return res.status(404).json({
      error: 'Comment not found',
    });
  }

  // Check thread depth
  const threadDepth = await getThreadDepth(commentId);
  if (threadDepth >= 5) {
    return res.status(400).json({
      error: 'Maximum thread depth of 5 levels reached',
    });
  }

  // Create the reply
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
}));

// Like a comment
router.post('/:postId/comments/:commentId/like', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { postId, commentId } = req.params;

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  // Check if comment exists and belongs to the post
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.postId !== postId) {
    return res.status(404).json({
      error: 'Comment not found',
    });
  }

  // Check if user already liked this comment
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

  // Create the like
  await prisma.commentLike.create({
    data: {
      userId: req.user.id,
      commentId: commentId,
    },
  });

  // Get updated like count
  const likeCount = await prisma.commentLike.count({
    where: { commentId: commentId },
  });

  invalidateCache.invalidatePostCache(post.slug);

  return res.status(201).json({
    message: 'Comment liked successfully',
    likeCount,
  });
}));

// Unlike a comment
router.delete('/:postId/comments/:commentId/like', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { postId, commentId } = req.params;

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  // Check if comment exists and belongs to the post
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.postId !== postId) {
    return res.status(404).json({
      error: 'Comment not found',
    });
  }

  // Check if user has liked this comment
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

  // Delete the like
  await prisma.commentLike.delete({
    where: {
      userId_commentId: {
        userId: req.user.id,
        commentId: commentId,
      },
    },
  });

  // Get updated like count
  const likeCount = await prisma.commentLike.count({
    where: { commentId: commentId },
  });

  invalidateCache.invalidatePostCache(post.slug);

  return res.json({
    message: 'Comment unliked successfully',
    likeCount,
  });
}));

// Get related posts for a post by slug
router.get('/:slug/related', cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { slug } = req.params;

  // Find the post by slug
  const post = await prisma.post.findUnique({
    where: { slug, published: true },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  // Get all tag IDs for this post
  const tagIds = post.tags.map((postTag: any) => postTag.tagId);

  // If post has no tags, return empty array
  if (tagIds.length === 0) {
    return res.json({
      posts: [],
    });
  }


  const relatedPosts = await prisma.post.findMany({
    where: {
      published: true,
      id: {
        not: post.id,
      },
      tags: {
        some: {
          tagId: {
            in: tagIds,
          },
        },
      },
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
    orderBy: [
      { featured: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 5,
  });

  // Get like counts for each related post
  const postsWithLikes = await Promise.all(
    relatedPosts.map(async (relatedPost) => {
      const likeCount = await prisma.postLike.count({
        where: { postId: relatedPost.id },
      });
      return {
        ...relatedPost,
        likeCount,
        tags: relatedPost.tags.map((postTag: any) => postTag.tag),
      };
    })
  );

  return res.json({
    posts: postsWithLikes,
  });
}));

// Get single post by slug
router.get('/:slug', cacheMiddleware(CACHE_CONFIG.TTL_POSTS_SINGLE), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { slug } = req.params;

  const post = await prisma.post.findUnique({
    where: { slug, published: true },
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
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  const likeCount = await prisma.postLike.count({
    where: { postId: post.id },
  });

  if (post.published) {
    await prisma.post.update({
      where: { id: post.id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });
    post.viewCount += 1;
  }

  const postWithLikes = {
    ...post,
    likeCount,
    tags: post.tags.map((postTag: any) => postTag.tag),
  };

  return res.json({ post: postWithLikes });
}));

router.get('/drafts/:slug', authenticateToken, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_SINGLE), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { slug } = req.params;

  const post = await prisma.post.findUnique({
    where: { slug, published: false },
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
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  if ((!req.user || req.user.id !== post.authorId)) {
    return res.status(403).json({
      error: 'Not authorized to view this post',
    });
  }

  const likeCount = await prisma.postLike.count({
    where: { postId: post.id },
  });

  const postWithLikes = {
    ...post,
    likeCount,
    tags: post.tags.map((postTag: any) => postTag.tag),
  };

  return res.json({ post: postWithLikes });
}));

// Create new post
router.post('/', validatePost, authenticateToken, handleValidationErrors, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { title, content, published = false, featured = false, categoryId, metaTitle, metaDescription, ogImage, tags } = req.body;
  const slug = generateSlug(title);

  // Check if slug already exists
  const existingPost = await prisma.post.findUnique({
    where: { slug },
  });

  if (existingPost) {
    return res.status(400).json({
      error: 'A post with this title already exists',
    });
  }

  const post = await prisma.post.create({
    data: {
      title,
      content,
      slug,
      published,
      featured,
      authorId: req.user.id,
      categoryId,
      metaTitle,
      metaDescription,
      ogImage,
      tags: tags && tags.length > 0 ? {
        create: tags.map((tagId: string) => ({ tagId })),
      } : undefined,
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
  });
  invalidateCache.invalidateListCaches();
  if (req.user) {
    invalidateCache.invalidateUserCaches(req.user.id);
  }

  const postWithTags = {
    ...post,
    tags: post.tags.map((postTag: any) => postTag.tag),
  };

  return res.status(201).json({
    message: 'Post created successfully',
    post: postWithTags,
  });
}));

// Update post
router.put('/:id', validatePost, authenticateToken, handleValidationErrors, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;
  const { title, content, published, featured, categoryId, metaTitle, metaDescription, ogImage, tags } = req.body;

  // Check if post exists and user owns it
  const existingPost = await prisma.post.findUnique({
    where: { id },
  });

  if (!existingPost) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  if (existingPost.authorId !== req.user.id) {
    return res.status(403).json({
      error: 'Not authorized to update this post',
    });
  }

  // Generate new slug if title changed
  let slug = existingPost.slug;
  if (title !== existingPost.title) {
    slug = generateSlug(title);

    // Check if new slug already exists
    const slugExists = await prisma.post.findUnique({
      where: { slug },
    });

    if (slugExists && slugExists.id !== id) {
      return res.status(400).json({
        error: 'A post with this title already exists',
      });
    }
  }

  // Update tags if provided
  if (tags !== undefined) {
    // Delete all existing tags for this post
    await prisma.postTag.deleteMany({
      where: { postId: id },
    });
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      title,
      content,
      slug,
      published,
      featured,
      categoryId,
      metaTitle,
      metaDescription,
      ogImage,
      tags: tags !== undefined ? {
        create: tags && tags.length > 0 ? tags.map((tagId: string) => ({ tagId })) : [],
      } : undefined,
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
  });

  invalidateCache.invalidateListCaches();
  invalidateCache.invalidatePostCache(post.slug);
  if (req.user) {
    invalidateCache.invalidateUserCaches(req.user.id);
  }

  const postWithTags = {
    ...post,
    tags: post.tags.map((postTag: any) => postTag.tag),
  };

  return res.json({
    message: 'Post updated successfully',
    post: postWithTags,
  });
}));

// Delete post
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  // Check if post exists and user owns it
  const existingPost = await prisma.post.findUnique({
    where: { id },
  });

  if (!existingPost) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  if (existingPost.authorId !== req.user.id) {
    return res.status(403).json({
      error: 'Not authorized to delete this post',
    });
  }

  await prisma.post.delete({
    where: { id },
  });

  invalidateCache.invalidateListCaches();
  invalidateCache.invalidatePostCache(existingPost.slug);
  if (req.user) {
    invalidateCache.invalidateUserCaches(req.user.id);
  }

  return res.json({
    message: 'Post deleted successfully',
  });
}));

// Like a post
router.post('/:id/like', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  // Check if user already liked this post
  const existingLike = await prisma.postLike.findUnique({
    where: {
      userId_postId: {
        userId: req.user.id,
        postId: id,
      },
    },
  });

  if (existingLike) {
    return res.status(400).json({
      error: 'You have already liked this post',
    });
  }

  // Create the like
  await prisma.postLike.create({
    data: {
      userId: req.user.id,
      postId: id,
    },
  });

  // Get updated like count
  const likeCount = await prisma.postLike.count({
    where: { postId: id },
  });

  invalidateCache.invalidateListCaches();
  invalidateCache.invalidatePostCache(post.slug);

  return res.status(201).json({
    message: 'Post liked successfully',
    likeCount,
  });
}));

// Unlike a post
router.delete('/:id/like', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  // Check if user has liked this post
  const existingLike = await prisma.postLike.findUnique({
    where: {
      userId_postId: {
        userId: req.user.id,
        postId: id,
      },
    },
  });

  if (!existingLike) {
    return res.status(400).json({
      error: 'You have not liked this post',
    });
  }

  // Delete the like
  await prisma.postLike.delete({
    where: {
      userId_postId: {
        userId: req.user.id,
        postId: id,
      },
    },
  });

  // Get updated like count
  const likeCount = await prisma.postLike.count({
    where: { postId: id },
  });

  invalidateCache.invalidateListCaches();
  invalidateCache.invalidatePostCache(post.slug);

  return res.json({
    message: 'Post unliked successfully',
    likeCount,
  });
}));

// Save a post
router.post('/:id/save', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  // Check if user already saved this post
  const existingSave = await prisma.savedPost.findUnique({
    where: {
      userId_postId: {
        userId: req.user.id,
        postId: id,
      },
    },
  });

  if (existingSave) {
    return res.status(400).json({
      error: 'You have already saved this post',
    });
  }

  // Create the save
  await prisma.savedPost.create({
    data: {
      userId: req.user.id,
      postId: id,
    },
  });

  invalidateCache.invalidateListCaches();
  invalidateCache.invalidatePostCache(post.slug);

  return res.status(201).json({
    message: 'Post saved successfully',
  });
}));

// Unsave a post
router.delete('/:id/save', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

  // Check if user has saved this post
  const existingSave = await prisma.savedPost.findUnique({
    where: {
      userId_postId: {
        userId: req.user.id,
        postId: id,
      },
    },
  });

  if (!existingSave) {
    return res.status(400).json({
      error: 'You have not saved this post',
    });
  }

  // Delete the save
  await prisma.savedPost.delete({
    where: {
      userId_postId: {
        userId: req.user.id,
        postId: id,
      },
    },
  });

  invalidateCache.invalidateListCaches();
  invalidateCache.invalidatePostCache(post.slug);

  return res.json({
    message: 'Post unsaved successfully',
  });
}));

export default router;
