import { Response } from 'express';
import { AuthRequest } from '../../utils/auth';
import * as postsService from '../../services/posts';

/**
 * Like a post
 */
export async function likePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  try {
    const result = await postsService.likePost(id, req.user.id);
    return res.status(201).json({
      message: 'Post liked successfully',
      likeCount: result.likeCount,
    });
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Post not found',
      });
    }
    if (error.message === 'You have already liked this post') {
      return res.status(400).json({
        error: 'You have already liked this post',
      });
    }
    throw error;
  }
}

/**
 * Unlike a post
 */
export async function unlikePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  try {
    const result = await postsService.unlikePost(id, req.user.id);
    return res.json({
      message: 'Post unliked successfully',
      likeCount: result.likeCount,
    });
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Post not found',
      });
    }
    if (error.message === 'You have not liked this post') {
      return res.status(400).json({
        error: 'You have not liked this post',
      });
    }
    throw error;
  }
}

/**
 * Save a post
 */
export async function savePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  try {
    await postsService.savePost(id, req.user.id);
    return res.status(201).json({
      message: 'Post saved successfully',
    });
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Post not found',
      });
    }
    if (error.message === 'You have already saved this post') {
      return res.status(400).json({
        error: 'You have already saved this post',
      });
    }
    throw error;
  }
}

/**
 * Unsave a post
 */
export async function unsavePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  try {
    await postsService.unsavePost(id, req.user.id);
    return res.json({
      message: 'Post unsaved successfully',
    });
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Post not found',
      });
    }
    if (error.message === 'You have not saved this post') {
      return res.status(400).json({
        error: 'You have not saved this post',
      });
    }
    throw error;
  }
}

