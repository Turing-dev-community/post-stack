import { Response } from 'express';
import { AuthRequest } from '../../utils/auth';
import * as postsService from '../../services/postsService';

/**
 * Create a new post
 */
export async function createPost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const {
    title,
    content,
    published = false,
    featured = false,
    categoryId,
    metaTitle,
    metaDescription,
    ogImage,
    tags,
  } = req.body;

  try {
    const post = await postsService.createPost(
      {
        title,
        content,
        published,
        featured,
        categoryId,
        metaTitle,
        metaDescription,
        ogImage,
        tags,
      },
      req.user.id
    );

    return res.status(201).json({
      message: 'Post created successfully',
      post,
    });
  } catch (error: any) {
    if (error.message === 'A post with this title already exists') {
      return res.status(400).json({
        error: error.message,
      });
    }
    throw error;
  }
}

/**
 * Update an existing post
 */
export async function updatePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;
  const {
    title,
    content,
    published,
    featured,
    categoryId,
    metaTitle,
    metaDescription,
    ogImage,
    tags,
  } = req.body;

  try {
    const post = await postsService.updatePost(
      id,
      {
        title,
        content,
        published,
        featured,
        categoryId,
        metaTitle,
        metaDescription,
        ogImage,
        tags,
      },
      req.user.id
    );

    return res.json({
      message: 'Post updated successfully',
      post,
    });
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Post not found',
      });
    }
    if (error.message === 'Not authorized to update this post') {
      return res.status(403).json({
        error: 'Not authorized to update this post',
      });
    }
    throw error;
  }
}

/**
 * Delete a post
 */
export async function deletePost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;

  try {
    await postsService.deletePost(id, req.user.id);
    return res.json({
      message: 'Post deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Post not found',
      });
    }
    if (error.message === 'Not authorized to delete this post') {
      return res.status(403).json({
        error: 'Not authorized to delete this post',
      });
    }
    throw error;
  }
}

