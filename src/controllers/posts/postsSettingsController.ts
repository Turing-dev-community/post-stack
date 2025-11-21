import { Response } from 'express';
import { AuthRequest } from '../../utils/auth';
import * as postsService from '../../services/posts';

/**
 * Update comment settings for a post
 */
export async function updateCommentSettings(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const { id } = req.params;
  const { allowComments } = req.body as { allowComments: boolean };

  try {
    const updated = await postsService.updateCommentSettings(id, allowComments, req.user.id);

    return res.json({
      message: 'Comment settings updated successfully',
      post: updated,
    });
  } catch (error: any) {
    if (error.message === 'Post not found') {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (error.message === 'Not authorized to update this post') {
      return res.status(403).json({ error: 'Not authorized to update this post' });
    }
    throw error;
  }
}

