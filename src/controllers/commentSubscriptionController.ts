import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import { checkAuth } from '../utils/authDecorator';
import { ResponseHandler } from '../utils/response';
import * as commentSubscriptionService from '../services/commentSubscriptionService';
import { NotFoundError } from '../utils/errors';
import { prisma } from '../lib/prisma';

/**
 * Subscribe to a comment thread
 * POST /api/posts/:postId/comments/:commentId/subscribe
 */
export async function subscribeToComment(
    req: AuthRequest,
    res: Response
): Promise<void> {
    if (!checkAuth(req, res)) return;

    const { postId, commentId } = req.params;
    const userId = req.user!.id;

    const responseHandler = new ResponseHandler(res);

    try {
        // Verify post exists
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { id: true },
        });

        if (!post) {
            responseHandler.error(new NotFoundError('Post not found'));
            return;
        }

        // Verify comment exists and belongs to the post
        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            select: { id: true, postId: true, deletedAt: true },
        });

        if (!comment || comment.deletedAt) {
            responseHandler.error(new NotFoundError('Comment not found'));
            return;
        }

        if (comment.postId !== postId) {
            responseHandler.error(new NotFoundError('Comment does not belong to this post'));
            return;
        }

        const subscription = await commentSubscriptionService.subscribeToComment(
            userId,
            commentId
        );

        responseHandler.created({
            message: 'Successfully subscribed to comment thread',
            subscription,
        });
    } catch (error) {
        responseHandler.error(error);
    }
}

/**
 * Unsubscribe from a comment thread
 * DELETE /api/posts/:postId/comments/:commentId/subscribe
 */
export async function unsubscribeFromComment(
    req: AuthRequest,
    res: Response
): Promise<void> {
    if (!checkAuth(req, res)) return;

    const { postId, commentId } = req.params;
    const userId = req.user!.id;

    const responseHandler = new ResponseHandler(res);

    try {
        // Verify post exists
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { id: true },
        });

        if (!post) {
            responseHandler.error(new NotFoundError('Post not found'));
            return;
        }

        // Verify comment exists and belongs to the post
        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            select: { id: true, postId: true, deletedAt: true },
        });

        if (!comment || comment.deletedAt) {
            responseHandler.error(new NotFoundError('Comment not found'));
            return;
        }

        if (comment.postId !== postId) {
            responseHandler.error(new NotFoundError('Comment does not belong to this post'));
            return;
        }

        await commentSubscriptionService.unsubscribeFromComment(userId, commentId);

        responseHandler.ok({
            message: 'Successfully unsubscribed from comment thread',
        });
    } catch (error) {
        responseHandler.error(error);
    }
}
