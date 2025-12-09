import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Comment Pinning API', () => {
    const authorId = 'author-1';
    const otherUserId = 'user-2';
    const postId = 'post-1';
    const commentId = 'comment-1';

    const authorToken = (() => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
        return generateToken(authorId);
    })();

    const otherUserToken = (() => {
        return generateToken(otherUserId);
    })();

    const mockAuthor = {
        id: authorId,
        email: 'author@example.com',
        username: 'author',
        deletedAt: null,
    };

    const mockOtherUser = {
        id: otherUserId,
        email: 'other@example.com',
        username: 'otheruser',
        deletedAt: null,
    };

    const mockPost = {
        id: postId,
        title: 'Test Post',
        slug: 'test-post',
        authorId: authorId,
        pinnedCommentId: null,
    };

    const mockComment = {
        id: commentId,
        content: 'This is a test comment',
        postId: postId,
        userId: otherUserId,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    describe('POST /:postId/comments/:commentId/pin', () => {
        it('should pin a comment successfully when user is post author', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
            (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
            (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);
            (prismaMock.post.update as jest.Mock).mockResolvedValue({
                ...mockPost,
                pinnedCommentId: commentId,
            });

            const res = await request(app)
                .post(`/api/posts/${postId}/comments/${commentId}/pin`)
                .set('Authorization', `Bearer ${authorToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('message', 'Comment pinned successfully');
            expect(res.body).toHaveProperty('pinnedCommentId', commentId);
        });

        it('should return 403 when trying to pin a comment on another user\'s post', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockOtherUser);
            (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);

            const res = await request(app)
                .post(`/api/posts/${postId}/comments/${commentId}/pin`)
                .set('Authorization', `Bearer ${otherUserToken}`)
                .expect(403);

            expect(res.body).toHaveProperty('error', 'ForbiddenError');
            expect(res.body).toHaveProperty('message', 'Only the post author can pin comments');
        });

        it('should return 404 when post does not exist', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
            (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post(`/api/posts/non-existent/comments/${commentId}/pin`)
                .set('Authorization', `Bearer ${authorToken}`)
                .expect(404);

            expect(res.body).toHaveProperty('error', 'NotFoundError');
            expect(res.body).toHaveProperty('message', 'Post not found');
        });

        it('should return 404 when comment does not exist', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
            (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
            (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post(`/api/posts/${postId}/comments/non-existent/pin`)
                .set('Authorization', `Bearer ${authorToken}`)
                .expect(404);

            expect(res.body).toHaveProperty('error', 'NotFoundError');
            expect(res.body).toHaveProperty('message', 'Comment not found');
        });

        it('should return 404 when comment does not belong to the post', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
            (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
            (prismaMock.comment.findUnique as jest.Mock).mockResolvedValue({
                ...mockComment,
                postId: 'other-post-id',
            });

            const res = await request(app)
                .post(`/api/posts/${postId}/comments/${commentId}/pin`)
                .set('Authorization', `Bearer ${authorToken}`)
                .expect(404);

            expect(res.body).toHaveProperty('error', 'NotFoundError');
            expect(res.body).toHaveProperty('message', 'Comment does not belong to this post');
        });

        it('should return 401 when not authenticated', async () => {
            const res = await request(app)
                .post(`/api/posts/${postId}/comments/${commentId}/pin`)
                .expect(401);

            expect(res.body).toHaveProperty('error', 'Access token required');
        });
    });

    describe('DELETE /:postId/comments/:commentId/pin', () => {
        it('should unpin a comment successfully', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
            (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
                ...mockPost,
                pinnedCommentId: commentId,
            });
            (prismaMock.post.update as jest.Mock).mockResolvedValue({
                ...mockPost,
                pinnedCommentId: null,
            });

            const res = await request(app)
                .delete(`/api/posts/${postId}/comments/${commentId}/pin`)
                .set('Authorization', `Bearer ${authorToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('message', 'Comment unpinned successfully');
        });

        it('should return 400 when no comment is pinned', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
            (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);

            const res = await request(app)
                .delete(`/api/posts/${postId}/comments/${commentId}/pin`)
                .set('Authorization', `Bearer ${authorToken}`)
                .expect(400);

            expect(res.body).toHaveProperty('error', 'BadRequestError');
            expect(res.body).toHaveProperty('message', 'No comment is currently pinned');
        });

        it('should return 400 when trying to unpin a different comment', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
            (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
                ...mockPost,
                pinnedCommentId: 'other-comment-id',
            });

            const res = await request(app)
                .delete(`/api/posts/${postId}/comments/${commentId}/pin`)
                .set('Authorization', `Bearer ${authorToken}`)
                .expect(400);

            expect(res.body).toHaveProperty('error', 'BadRequestError');
            expect(res.body).toHaveProperty('message', 'This comment is not pinned');
        });

        it('should return 403 when trying to unpin on another user\'s post', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockOtherUser);
            (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
                ...mockPost,
                pinnedCommentId: commentId,
            });

            const res = await request(app)
                .delete(`/api/posts/${postId}/comments/${commentId}/pin`)
                .set('Authorization', `Bearer ${otherUserToken}`)
                .expect(403);

            expect(res.body).toHaveProperty('error', 'ForbiddenError');
            expect(res.body).toHaveProperty('message', 'Only the post author can unpin comments');
        });
    });
});
