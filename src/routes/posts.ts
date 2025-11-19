import { Router, Response } from 'express';
import { authenticateToken } from '../utils/auth';
import { validatePost, validateComment, validatePagination } from '../middleware/validators';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { AuthRequest } from '../utils/auth';
import { cacheMiddleware } from '../middleware/cache';
import { CACHE_CONFIG } from '../constants/cache';
import { estimateReadingTime } from '../utils/readingTime';

const router = Router();

router.get('/', validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(async (req: AuthRequest, res: Response) => {
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
        readingTime: estimateReadingTime(post.content),
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
router.get('/trending', validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(async (req: AuthRequest, res: Response) => {
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

  const postsWithReading = posts.map((post) => ({
    ...post,
    readingTime: estimateReadingTime(post.content),
  }));

  return res.json({
    posts: postsWithReading,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Get all posts for authenticated user (including unpublished)
router.get('/my-posts', authenticateToken, validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(async (req: AuthRequest, res: Response) => {
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
        readingTime: estimateReadingTime(post.content),
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
router.get('/saved', authenticateToken, validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(async (req: AuthRequest, res: Response) => {
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
        readingTime: estimateReadingTime(savedPost.post.content),
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
        readingTime: estimateReadingTime(relatedPost.content),
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
    readingTime: estimateReadingTime(post.content),
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
    readingTime: estimateReadingTime(post.content),
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
    readingTime: estimateReadingTime(post.content),
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
  }

  // Update tags if provided - use transaction to ensure atomicity
  // If post update fails, tags should not be deleted
  const post = await prisma.$transaction(async (tx) => {
    // Delete all existing tags for this post if tags are being updated
    if (tags !== undefined) {
      await tx.postTag.deleteMany({
        where: { postId: id },
      });
    }

    // Update post with new tags
    return await tx.post.update({
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
  });

  invalidateCache.invalidateListCaches();
  invalidateCache.invalidatePostCache(post.slug);
  if (req.user) {
    invalidateCache.invalidateUserCaches(req.user.id);
  }

  const postWithTags = {
    ...post,
    readingTime: estimateReadingTime(post.content),
    tags: post.tags.map((postTag: any) => postTag.tag),
  };

  return res.json({
    message: 'Post updated successfully',
    post: postWithTags,
  });
}));

// Delete post
router.delete('/:id', authenticateToken, asyncHandler(
  (req: AuthRequest, res: Response) => postsController.deletePost(req, res)
));

// Like a post
router.post('/:id/like', authenticateToken, asyncHandler(
  (req: AuthRequest, res: Response) => postsController.likePost(req, res)
));

// Unlike a post
router.delete('/:id/like', authenticateToken, asyncHandler(
  (req: AuthRequest, res: Response) => postsController.unlikePost(req, res)
));

// Save a post
router.post('/:id/save', authenticateToken, asyncHandler(
  (req: AuthRequest, res: Response) => postsController.savePost(req, res)
));

// Unsave a post
router.delete('/:id/save', authenticateToken, asyncHandler(
  (req: AuthRequest, res: Response) => postsController.unsavePost(req, res)
));

export default router;
