/**
 * Type definitions for CommentSubscription model
 * Used for mock-based testing without schema changes
 */

/**
 * CommentSubscription entity type
 */
export interface CommentSubscription {
    id: string;
    userId: string;
    commentId: string;
    createdAt: Date;
}

/**
 * Unique composite key for CommentSubscription
 */
export interface CommentSubscriptionUniqueKey {
    userId_commentId: {
        userId: string;
        commentId: string;
    };
}

/**
 * Create input for CommentSubscription
 */
export interface CommentSubscriptionCreateInput {
    data: {
        userId: string;
        commentId: string;
    };
    select?: {
        id?: boolean;
        userId?: boolean;
        commentId?: boolean;
        createdAt?: boolean;
    };
}

/**
 * Find unique input for CommentSubscription
 */
export interface CommentSubscriptionFindUniqueInput {
    where: CommentSubscriptionUniqueKey;
}

/**
 * Delete input for CommentSubscription
 */
export interface CommentSubscriptionDeleteInput {
    where: CommentSubscriptionUniqueKey;
}

/**
 * Find many input for CommentSubscription
 */
export interface CommentSubscriptionFindManyInput {
    where?: {
        commentId?: string;
        userId?: string;
    };
    select?: {
        userId?: boolean;
        commentId?: boolean;
        id?: boolean;
        createdAt?: boolean;
    };
}

/**
 * CommentSubscription Prisma-like delegate interface
 * Mirrors PrismaClient model delegates for type-safe mocking
 */
export interface CommentSubscriptionDelegate {
    findUnique(args: CommentSubscriptionFindUniqueInput): Promise<CommentSubscription | null>;
    create(args: CommentSubscriptionCreateInput): Promise<CommentSubscription>;
    delete(args: CommentSubscriptionDeleteInput): Promise<CommentSubscription>;
    findMany(args: CommentSubscriptionFindManyInput): Promise<Array<{ userId: string }>>;
}

/**
 * Extended PrismaClient type that includes the CommentSubscription model
 * for use in mocking without schema changes
 */
export interface ExtendedPrismaClient {
    commentSubscription: CommentSubscriptionDelegate;
}
