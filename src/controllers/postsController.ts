import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import { generateSlug } from '../utils/auth';
import { invalidateCache } from '../middleware/cache';
import { prisma } from '../lib/prisma';
import { estimateReadingTime } from '../utils/readingTime';

/**
 * Helper function to add like counts to posts
 */
async function addLikeCountsToPosts(posts: any[]): Promise<any[]> {
  return Promise.all(
    posts.map(async (post) => {
      const likeCount = await prisma.postLike.count({ where: { postId: post.id } });
      return {
        ...post,
        likeCount,
        readingTime: estimateReadingTime(post.content),
        tags: post.tags ? post.tags.map((postTag: any) => postTag.tag) : [],
      };
    })
  );
}

/**
 * Get all published posts with pagination, filtering, and sorting
 */
export async function getAllPosts(req: AuthRequest, res: Response): Promise<Response> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const titleQuery = req.query.title as string;
  const authorIdQuery = req.query.authorId as string;
  const categoryIdQuery = req.query.categoryId as string;
  const sortBy = (req.query.sortBy as string) || 'createdAt';
  const sortOrder = (req.query.sortOrder as string) || 'desc';
  const skip = (page - 1) * limit;

  if (titleQuery !== undefined && (!titleQuery || titleQuery.trim().length === 0)) {
    return res.status(400).json({
      error: 'Title search query cannot be empty',
    });
  }

  const validSortFields = ['createdAt', 'updatedAt', 'title'];
  if (!validSortFields.includes(sortBy)) {
    return res.status(400).json({
      error: `Invalid sort field. Must be one of: ${validSortFields.join(', ')}`,
    });
  }

  const validSortOrders = ['asc', 'desc'];
  if (!validSortOrders.includes(sortOrder.toLowerCase())) {
    return res.status(400).json({
      error: `Invalid sort order. Must be one of: ${validSortOrders.join(', ')}`,
    });
  }

  const whereClause: any = { published: true };

  if (titleQuery && titleQuery.trim()) {
    whereClause.title = {
      contains: titleQuery.trim(),
      mode: 'insensitive',
    };
  }

  if (authorIdQuery) {
    whereClause.authorId = authorIdQuery;
  }

  if (categoryIdQuery) {
    whereClause.categoryId = categoryIdQuery;
  }

  const orderBy: any[] = [
    { featured: 'desc' },
    { [sortBy]: sortOrder.toLowerCase() as 'asc' | 'desc' },
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

  const postsWithLikes = await addLikeCountsToPosts(posts);

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
}


export async function getTrendingPosts(req: AuthRequest, res: Response): Promise<Response> {
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
    orderBy: [{ viewCount: 'desc' }],
    skip,
    take: limit,
  });

  const total = await prisma.post.count({
    where: whereClause,
  });

  return res.json({
    posts: posts.map((post) => ({
      ...post,
      readingTime: estimateReadingTime(post.content),
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

/**
 * Get all posts for authenticated user (including unpublished)
 */
export async function getMyPosts(req: AuthRequest, res: Response): Promise<Response> {
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

  const postsWithLikes = await addLikeCountsToPosts(posts);

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
}

/**
 * Get saved posts for authenticated user
 */
export async function getSavedPosts(req: AuthRequest, res: Response): Promise<Response> {
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

  const postsWithLikes = await Promise.all(
    savedPosts.map(async (savedPost) => {
      const likeCount = await prisma.postLike.count({ where: { postId: savedPost.post.id } });
      return {
        ...savedPost.post,
        likeCount,
        readingTime: estimateReadingTime(savedPost.post.content),
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
}

export async function getRelatedPosts(req: AuthRequest, res: Response): Promise<Response> {
  const { slug } = req.params;

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

  const tagIds = post.tags.map((postTag: any) => postTag.tagId);

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

  const postsWithLikes = await addLikeCountsToPosts(relatedPosts);

  return res.json({
    posts: postsWithLikes,
  });
}


export async function getPostBySlug(req: AuthRequest, res: Response): Promise<Response> {
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
}

/**
 * Get draft post by slug (authenticated, owner only)
 */
export async function getDraftBySlug(req: AuthRequest, res: Response): Promise<Response> {
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

  if (!req.user || req.user.id !== post.authorId) {
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
}


export async function createPost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { title, content, published = false, featured = false, categoryId, metaTitle, metaDescription, ogImage, tags } = req.body;
  const slug = generateSlug(title);

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
}


export async function updatePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;
  const { title, content, published, featured, categoryId, metaTitle, metaDescription, ogImage, tags } = req.body;

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

  let slug = existingPost.slug;
  if (title !== existingPost.title) {
    slug = generateSlug(title);
  }

  const post = await prisma.$transaction(async (tx) => {
    if (tags !== undefined) {
      await tx.postTag.deleteMany({
        where: { postId: id },
      });
    }

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
}


export async function deletePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

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
}


export async function likePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

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

  await prisma.postLike.create({
    data: {
      userId: req.user.id,
      postId: id,
    },
  });

  const likeCount = await prisma.postLike.count({
    where: { postId: id },
  });

  invalidateCache.invalidateListCaches();
  invalidateCache.invalidatePostCache(post.slug);

  return res.status(201).json({
    message: 'Post liked successfully',
    likeCount,
  });
}


export async function unlikePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

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

  await prisma.postLike.delete({
    where: {
      userId_postId: {
        userId: req.user.id,
        postId: id,
      },
    },
  });

  const likeCount = await prisma.postLike.count({
    where: { postId: id },
  });

  invalidateCache.invalidateListCaches();
  invalidateCache.invalidatePostCache(post.slug);

  return res.json({
    message: 'Post unliked successfully',
    likeCount,
  });
}

export async function savePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

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
}


export async function unsavePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).json({
      error: 'Post not found',
    });
  }

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
}

