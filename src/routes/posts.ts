import { Router, Response } from 'express';
import { authenticateToken } from '../utils/auth';
import { validatePost, validateComment, validatePagination } from '../middleware/validators';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { AuthRequest } from '../utils/auth';
import { cacheMiddleware } from '../middleware/cache';
import { CACHE_CONFIG } from '../constants/cache';
import { requireAuthor } from '../middleware/authorization';
import * as postsController from '../controllers/postsController';

const router = Router();

router.get('/', validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getAllPosts(req, res)
));

router.get('/trending', validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getTrendingPosts(req, res)
));

// Get all posts for authenticated user (including unpublished)
router.get('/my-posts', authenticateToken, validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getMyPosts(req, res)
));

// Get saved posts for authenticated user
router.get('/saved', authenticateToken, validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getSavedPosts(req, res)
));

// Get related posts for a post by slug
router.get('/:slug/related', cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getRelatedPosts(req, res)
));

// Get single post by slug
router.get('/:slug', cacheMiddleware(CACHE_CONFIG.TTL_POSTS_SINGLE), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getPostBySlug(req, res)
));

router.get('/drafts/:slug', authenticateToken, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_SINGLE), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getDraftBySlug(req, res)
));

// Create new post
router.post('/', validatePost, authenticateToken, requireAuthor, handleValidationErrors, asyncHandler(async (req: AuthRequest, res: Response) => {
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
router.put('/:id', validatePost, authenticateToken, handleValidationErrors, asyncHandler(
  (req: AuthRequest, res: Response) => postsController.updatePost(req, res)
));

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