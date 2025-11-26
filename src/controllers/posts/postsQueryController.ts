import { Response } from 'express';
import { AuthRequest } from '../../utils/auth';
import * as postsService from '../../services/posts';
import { checkAuth } from '../../utils/authDecorator';

/**
 * Get all published posts with pagination, filtering, and sorting
 */
export async function getAllPosts(req: AuthRequest, res: Response): Promise<Response> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const titleQuery = req.query.title as string;
  const authorIdQuery = req.query.authorId as string;
  const categoryIdQuery = req.query.categoryId as string;
  const tagNameQuery = req.query.tag as string;
  const fromDateQuery = req.query.fromDate as string;
  const toDateQuery = req.query.toDate as string;
  const sortBy = (req.query.sortBy as string) || 'createdAt';
  const sortOrder = (req.query.sortOrder as string) || 'desc';

  // Validate query parameters
  const validation = postsService.validatePostQueryParams(
    titleQuery,
    sortBy,
    sortOrder,
    fromDateQuery,
    toDateQuery
  );

  if (!validation.isValid) {
    return res.status(400).json({
      error: validation.error,
    });
  }

  const filters: postsService.PostFilters = {
    title: titleQuery,
    authorId: authorIdQuery,
    categoryId: categoryIdQuery,
    tag: tagNameQuery,
    fromDate: fromDateQuery,
    toDate: toDateQuery,
  };

  const pagination: postsService.PaginationParams = { page, limit };
  const sortParams: postsService.SortParams = { sortBy, sortOrder };

  const result = await postsService.getAllPosts(filters, pagination, sortParams);

  return res.json(result);
}

/**
 * Get trending posts (last 30 days, sorted by view count)
 */
export async function getTrendingPosts(req: AuthRequest, res: Response): Promise<Response> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const pagination: postsService.PaginationParams = { page, limit };
  const result = await postsService.getTrendingPosts(pagination);

  return res.json(result);
}

/**
 * Get popular posts sorted by like count
 */
export async function getPopularPosts(req: AuthRequest, res: Response): Promise<Response> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const pagination: postsService.PaginationParams = { page, limit };
  const result = await postsService.getPopularPosts(pagination);

  return res.json(result);
}

/**
 * Get all posts for authenticated user (including unpublished)
 */
export async function getMyPosts(req: AuthRequest, res: Response): Promise<Response> {
  if (!checkAuth(req, res)) return res as Response;

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const pagination: postsService.PaginationParams = { page, limit };
  const result = await postsService.getMyPosts(req.user.id, pagination);

  return res.json(result);
}

/**
 * Get saved posts for authenticated user
 */
export async function getSavedPosts(req: AuthRequest, res: Response): Promise<Response> {
  if (!checkAuth(req, res)) return res as Response;

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const pagination: postsService.PaginationParams = { page, limit };
  const result = await postsService.getSavedPosts(req.user.id, pagination);

  return res.json(result);
}

/**
 * Get related posts by slug
 */
export async function getRelatedPosts(req: AuthRequest, res: Response): Promise<Response> {
  const { slug } = req.params;

  try {
    const result = await postsService.getRelatedPosts(slug);
    return res.json(result);
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Post not found',
      });
    }
    throw error;
  }
}

/**
 * Get post by slug
 */
export async function getPostBySlug(req: AuthRequest, res: Response): Promise<Response> {
  const { slug } = req.params;

  try {
    const post = await postsService.getPostBySlug(slug);
    return res.json({ post });
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Post not found',
      });
    }
    throw error;
  }
}

/**
 * Get draft post by slug (authenticated, owner only)
 */
export async function getDraftBySlug(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { slug } = req.params;

  try {
    const post = await postsService.getDraftBySlug(slug, req.user.id);
    return res.json({ post });
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Post not found',
      });
    }
    if (error.message === 'Not authorized to view this post') {
      return res.status(403).json({
        error: 'Not authorized to view this post',
      });
    }
    throw error;
  }
}

