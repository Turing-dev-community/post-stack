import { Router, Response } from 'express';
import { authenticateToken } from '../utils/auth';
import { validatePost, validateComment, validatePagination, validateCommentSettings, validateBulkPosts } from '../middleware/validators';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { AuthRequest } from '../utils/auth';
import { cacheMiddleware } from '../middleware/cache';
import { CACHE_CONFIG } from '../constants/cache';
import * as postsController from '../controllers/posts';
import { getRecentComments } from '../controllers/commentsController';
import { requireAuthor } from '../middleware/authorization';
import { reportPost } from '../controllers/reportsController';
import { validatePostReport } from '../middleware/validators';

const router = Router();

router.get('/', validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getAllPosts(req, res)
));

router.get('/trending', validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getTrendingPosts(req, res)
));

router.get('/popular', validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getPopularPosts(req, res)
));

// Get all posts for authenticated user (including unpublished)
router.get('/my-posts', authenticateToken, validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getMyPosts(req, res)
));

// Get saved posts for authenticated user
router.get('/saved', authenticateToken, validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_POSTS_LIST), asyncHandler(
  (req: AuthRequest, res: Response) => postsController.getSavedPosts(req, res)
));

// Get recent comments across all posts
router.get('/recent-comments', validatePagination, handleValidationErrors, cacheMiddleware(CACHE_CONFIG.TTL_COMMENTS_RECENT), getRecentComments);

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
router.post('/', validatePost, authenticateToken, requireAuthor, handleValidationErrors, asyncHandler(
  (req: AuthRequest, res: Response) => postsController.createPost(req, res)
));

// Create multiple posts in bulk
router.post('/bulk', validateBulkPosts, authenticateToken, requireAuthor, handleValidationErrors, asyncHandler(
  (req: AuthRequest, res: Response) => postsController.bulkCreatePosts(req, res)
));

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

// Update comment settings (enable/disable comments)
router.patch('/:id/comments/settings', authenticateToken, validateCommentSettings, handleValidationErrors, asyncHandler(
  (req: AuthRequest, res: Response) => postsController.updateCommentSettings(req, res)
));

router.post('/:postId/report', authenticateToken, validatePostReport, handleValidationErrors, asyncHandler(
  (req: AuthRequest, res: Response) => reportPost(req, res)
));

export default router;