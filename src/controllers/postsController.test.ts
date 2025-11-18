import { Request, Response } from 'express';
import * as postsController from './postsController';
import { AuthRequest } from '../utils/auth';
import { setupPrismaMock, MockedPrismaClient } from '../test/utils/mockPrisma';

jest.mock('../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  const { PrismaClient } = require('@prisma/client');
  return {
    __esModule: true,
    prisma: mockDeep(PrismaClient),
  };
});

import { prisma } from '../lib/prisma';

const { prisma: prismaMock } = setupPrismaMock(prisma, {} as any);

describe('PostsController', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    mockResponse = {
      json: jsonMock,
      status: statusMock,
    } as Partial<Response>;

    mockRequest = {
      query: {},
      params: {},
      body: {},
      user: {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPosts', () => {
    it('should return all published posts with pagination', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Post 1',
          content: 'Content 1',
          slug: 'post-1',
          published: true,
          author: { id: 'user-1', username: 'author1' },
          category: null,
          tags: [],
        },
      ];

      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(5);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      mockRequest.query = { page: '1', limit: '10' };

      await postsController.getAllPosts(mockRequest as AuthRequest, mockResponse as Response);

      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { published: true },
        })
      );
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: 1,
            pages: 1,
          }),
        })
      );
    });

    it('should filter by title query', async () => {
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);

      mockRequest.query = { title: 'test' };

      await postsController.getAllPosts(mockRequest as AuthRequest, mockResponse as Response);

      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            title: expect.objectContaining({
              contains: 'test',
              mode: 'insensitive',
            }),
          }),
        })
      );
    });

    it('should return 400 for empty title query', async () => {
      mockRequest.query = { title: '   ' };

      await postsController.getAllPosts(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Title search query cannot be empty',
      });
    });

    it('should validate sort fields', async () => {
      mockRequest.query = { sortBy: 'invalid' };

      await postsController.getAllPosts(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Invalid sort field'),
        })
      );
    });
  });

  describe('getPostBySlug', () => {
    it('should return a post by slug', async () => {
      const mockPost = {
        id: 'post-1',
        title: 'Test Post',
        content: 'Content',
        slug: 'test-post',
        published: true,
        viewCount: 10,
        author: { id: 'user-1', username: 'author1' },
        category: null,
        tags: [],
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(5);
      (prismaMock.post.update as jest.Mock).mockResolvedValue({ ...mockPost, viewCount: 11 });

      mockRequest.params = { slug: 'test-post' };

      await postsController.getPostBySlug(mockRequest as AuthRequest, mockResponse as Response);

      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-post', published: true },
        include: expect.any(Object),
      });
      expect(jsonMock).toHaveBeenCalledWith({
        post: expect.objectContaining({
          slug: 'test-post',
          likeCount: 5,
        }),
      });
    });

    it('should return 404 if post not found', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);

      mockRequest.params = { slug: 'non-existent' };

      await postsController.getPostBySlug(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Post not found',
      });
    });

    it('should increment view count for published posts', async () => {
      const mockPost = {
        id: 'post-1',
        title: 'Test Post',
        content: 'Content',
        slug: 'test-post',
        published: true,
        viewCount: 10,
        author: { id: 'user-1', username: 'author1' },
        category: null,
        tags: [],
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.update as jest.Mock).mockResolvedValue({ ...mockPost, viewCount: 11 });

      mockRequest.params = { slug: 'test-post' };

      await postsController.getPostBySlug(mockRequest as AuthRequest, mockResponse as Response);

      expect(prismaMock.post.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: {
          viewCount: {
            increment: 1,
          },
        },
      });
    });
  });

  describe('createPost', () => {
    it('should create a new post', async () => {
      const mockPost = {
        id: 'post-1',
        title: 'New Post',
        content: 'Content',
        slug: 'new-post',
        published: false,
        author: { id: 'user-1', username: 'testuser' },
        category: null,
        tags: [],
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.post.create as jest.Mock).mockResolvedValue(mockPost);

      mockRequest.body = {
        title: 'New Post',
        content: 'Content',
        published: false,
      };

      await postsController.createPost(mockRequest as AuthRequest, mockResponse as Response);

      expect(prismaMock.post.create).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Post created successfully',
          post: expect.any(Object),
        })
      );
    });

    it('should return 400 if post with same title exists', async () => {
      const existingPost = {
        id: 'post-1',
        title: 'Existing Post',
        slug: 'existing-post',
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(existingPost);

      mockRequest.body = {
        title: 'Existing Post',
        content: 'Content',
      };

      await postsController.createPost(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'A post with this title already exists',
      });
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.body = {
        title: 'New Post',
        content: 'Content',
      };

      await postsController.createPost(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
    });
  });

  describe('updatePost', () => {
    it('should update a post', async () => {
      const existingPost = {
        id: 'post-1',
        title: 'Old Title',
        slug: 'old-title',
        authorId: 'user-1',
      };

      const updatedPost = {
        id: 'post-1',
        title: 'New Title',
        slug: 'new-title',
        content: 'Updated content',
        author: { id: 'user-1', username: 'testuser' },
        category: null,
        tags: [],
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(existingPost);
      (prismaMock.$transaction as jest.Mock).mockResolvedValue(updatedPost);

      mockRequest.params = { id: 'post-1' };
      mockRequest.body = {
        title: 'New Title',
        content: 'Updated content',
      };

      await postsController.updatePost(mockRequest as AuthRequest, mockResponse as Response);

      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: { id: 'post-1' },
      });
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Post updated successfully',
          post: expect.any(Object),
        })
      );
    });

    it('should return 403 if user does not own the post', async () => {
      const existingPost = {
        id: 'post-1',
        title: 'Post',
        authorId: 'other-user',
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(existingPost);

      mockRequest.params = { id: 'post-1' };
      mockRequest.body = { title: 'New Title' };

      await postsController.updatePost(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Not authorized to update this post',
      });
    });
  });

  describe('deletePost', () => {
    it('should delete a post', async () => {
      const existingPost = {
        id: 'post-1',
        title: 'Post',
        slug: 'post',
        authorId: 'user-1',
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(existingPost);
      (prismaMock.post.delete as jest.Mock).mockResolvedValue(existingPost);

      mockRequest.params = { id: 'post-1' };

      await postsController.deletePost(mockRequest as AuthRequest, mockResponse as Response);

      expect(prismaMock.post.delete).toHaveBeenCalledWith({
        where: { id: 'post-1' },
      });
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Post deleted successfully',
      });
    });
  });

  describe('likePost', () => {
    it('should like a post', async () => {
      const post = {
        id: 'post-1',
        slug: 'test-post',
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(post);
      (prismaMock.postLike.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.postLike.create as jest.Mock).mockResolvedValue({});
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(1);

      mockRequest.params = { id: 'post-1' };

      await postsController.likePost(mockRequest as AuthRequest, mockResponse as Response);

      expect(prismaMock.postLike.create).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Post liked successfully',
          likeCount: 1,
        })
      );
    });

    it('should return 400 if post already liked', async () => {
      const post = {
        id: 'post-1',
        slug: 'test-post',
      };

      const existingLike = {
        userId: 'user-1',
        postId: 'post-1',
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(post);
      (prismaMock.postLike.findUnique as jest.Mock).mockResolvedValue(existingLike);

      mockRequest.params = { id: 'post-1' };

      await postsController.likePost(mockRequest as AuthRequest, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'You have already liked this post',
      });
    });
  });

  describe('getPostComments', () => {
    it('should return comments for a post', async () => {
      const post = { id: 'post-1' };
      const comments = [
        {
          id: 'comment-1',
          content: 'Comment',
          postId: 'post-1',
          userId: 'user-1',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-1', username: 'user1' },
        },
      ];

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(post);
      (prismaMock.comment.findMany as jest.Mock).mockResolvedValue(comments);
      (prismaMock.commentLike.count as jest.Mock).mockResolvedValue(0);

      mockRequest.params = { postId: 'post-1' };

      await postsController.getPostComments(mockRequest as AuthRequest, mockResponse as Response);

      expect(prismaMock.comment.findMany).toHaveBeenCalledWith({
        where: { postId: 'post-1', parentId: null },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
      expect(jsonMock).toHaveBeenCalledWith({
        comments: expect.any(Array),
      });
    });
  });

  describe('createComment', () => {
    it('should create a comment on a post', async () => {
      const post = {
        id: 'post-1',
        slug: 'test-post',
      };

      const comment = {
        id: 'comment-1',
        content: 'New comment',
        postId: 'post-1',
        userId: 'user-1',
        user: { id: 'user-1', username: 'testuser' },
      };

      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(post);
      (prismaMock.comment.create as jest.Mock).mockResolvedValue(comment);

      mockRequest.params = { postId: 'post-1' };
      mockRequest.body = { content: 'New comment' };

      await postsController.createComment(mockRequest as AuthRequest, mockResponse as Response);

      expect(prismaMock.comment.create).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Comment created successfully',
          comment: expect.any(Object),
        })
      );
    });
  });
});

