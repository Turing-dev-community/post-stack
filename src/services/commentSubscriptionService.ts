import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';
import {
    CommentSubscription,
    CommentSubscriptionDelegate,
    ExtendedPrismaClient
} from '../types/commentSubscription';

/**
 * Type-safe accessor for commentSubscription model
 * Uses ExtendedPrismaClient interface for mock-based approach without schema changes
 */
const commentSubscription: CommentSubscriptionDelegate =
    (prisma as unknown as ExtendedPrismaClient).commentSubscription;

/**
 * Subscribe a user to a comment thread
 * @param userId - The ID of the user subscribing
 * @param commentId - The ID of the comment thread to subscribe to
 * @returns The created subscription
 * @throws NotFoundError if comment doesn't exist
 * @throws ConflictError if user is already subscribed
 */
export async function subscribeToComment(
    userId: string,
    commentId: string
): Promise<{ id: string; userId: string; commentId: string; createdAt: Date }> {
    // Verify comment exists
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { id: true, deletedAt: true },
    });

    if (!comment || comment.deletedAt) {
        throw new NotFoundError('Comment not found');
    }

    // Check if subscription already exists
    const existingSubscription = await commentSubscription.findUnique({
        where: {
            userId_commentId: {
                userId,
                commentId,
            },
        },
    });

    if (existingSubscription) {
        throw new ConflictError('You are already subscribed to this comment thread');
    }

    // Create subscription
    const subscription = await commentSubscription.create({
        data: {
            userId,
            commentId,
        },
        select: {
            id: true,
            userId: true,
            commentId: true,
            createdAt: true,
        },
    });

    return subscription;
}

/**
 * Unsubscribe a user from a comment thread
 * @param userId - The ID of the user unsubscribing
 * @param commentId - The ID of the comment thread to unsubscribe from
 * @throws NotFoundError if subscription doesn't exist
 */
export async function unsubscribeFromComment(
    userId: string,
    commentId: string
): Promise<void> {
    const subscription = await commentSubscription.findUnique({
        where: {
            userId_commentId: {
                userId,
                commentId,
            },
        },
    });

    if (!subscription) {
        throw new NotFoundError('You are not subscribed to this comment thread');
    }

    await commentSubscription.delete({
        where: {
            userId_commentId: {
                userId,
                commentId,
            },
        },
    });
}

/**
 * Check if a user is subscribed to a comment thread
 * @param userId - The ID of the user
 * @param commentId - The ID of the comment thread
 * @returns true if subscribed, false otherwise
 */
export async function isSubscribedToComment(
    userId: string,
    commentId: string
): Promise<boolean> {
    const subscription = await commentSubscription.findUnique({
        where: {
            userId_commentId: {
                userId,
                commentId,
            },
        },
    });

    return !!subscription;
}

/**
 * Get all subscribers for a comment thread
 * @param commentId - The ID of the comment thread
 * @returns Array of user IDs subscribed to the thread
 */
export async function getCommentSubscribers(commentId: string): Promise<string[]> {
    const subscriptions = await commentSubscription.findMany({
        where: { commentId },
        select: { userId: true },
    });

    return subscriptions.map((sub: { userId: string }) => sub.userId);
}
