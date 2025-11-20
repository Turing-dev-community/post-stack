import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Posts Filtering API', () => {
  it('should have mocking properly configured', () => {
    expect(prismaMock.isMocked).toBe(true);
  });

  describe('Filter by Tag Name', () => {
    it('should filter posts by tag name', async () => {
      const mockTag = {
        id: 'tag-1',
        name: 'technology',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPosts = [
        {
          id: 'post-1',
          title: 'Tech Post 1',
          content: 'Content',
          slug: 'tech-post-1',
          published: true,
          featured: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          authorId: 'user-1',
          categoryId: null,
          viewCount: 0,
          author: { id: 'user-1', username: 'author1' },
          category: null,
          tags: [
            {
              tag: { id: 'tag-1', name: 'technology' },
            },
          ],
        },
      ];

      (prismaMock.tag.findFirst as jest.Mock).mockResolvedValue(mockTag);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts')
        .query({ tag: 'technology' })
        .expect(200);

      expect(response.body).toHaveProperty('posts');
      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].title).toBe('Tech Post 1');
      expect(prismaMock.tag.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: 'technology',
            mode: 'insensitive',
          },
        },
      });
    });

    it('should return empty results for non-existent tag', async () => {
      (prismaMock.tag.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/posts')
        .query({ tag: 'non-existent-tag' })
        .expect(200);

      expect(response.body.posts).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });

    it('should be case insensitive when filtering by tag name', async () => {
      const mockTag = {
        id: 'tag-1',
        name: 'technology',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prismaMock.tag.findFirst as jest.Mock).mockResolvedValue(mockTag);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/posts')
        .query({ tag: 'TECHNOLOGY' })
        .expect(200);

      expect(prismaMock.tag.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: 'TECHNOLOGY',
            mode: 'insensitive',
          },
        },
      });
      expect(response.status).toBe(200);
    });

    it('should combine tag filter with other filters', async () => {
      const mockTag = {
        id: 'tag-1',
        name: 'technology',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPosts = [
        {
          id: 'post-1',
          title: 'Tech Post',
          content: 'Content',
          slug: 'tech-post',
          published: true,
          featured: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          authorId: 'user-1',
          categoryId: null,
          viewCount: 0,
          author: { id: 'user-1', username: 'author1' },
          category: null,
          tags: [
            {
              tag: { id: 'tag-1', name: 'technology' },
            },
          ],
        },
      ];

      (prismaMock.tag.findFirst as jest.Mock).mockResolvedValue(mockTag);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts')
        .query({ tag: 'technology', title: 'Tech' })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
    });
  });

  describe('Filter by Date Range', () => {
    it('should filter posts by fromDate', async () => {
      const fromDate = '2024-01-01';
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Recent Post',
          content: 'Content',
          slug: 'recent-post',
          published: true,
          featured: false,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          authorId: 'user-1',
          categoryId: null,
          viewCount: 0,
          author: { id: 'user-1', username: 'author1' },
          category: null,
          tags: [],
        },
      ];

      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts')
        .query({ fromDate })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            published: true,
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should filter posts by toDate', async () => {
      const toDate = '2024-12-31';
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Old Post',
          content: 'Content',
          slug: 'old-post',
          published: true,
          featured: false,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          authorId: 'user-1',
          categoryId: null,
          viewCount: 0,
          author: { id: 'user-1', username: 'author1' },
          category: null,
          tags: [],
        },
      ];

      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts')
        .query({ toDate })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            published: true,
            createdAt: expect.objectContaining({
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should filter posts by date range (fromDate and toDate)', async () => {
      const fromDate = '2024-01-01';
      const toDate = '2024-12-31';
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Post in Range',
          content: 'Content',
          slug: 'post-in-range',
          published: true,
          featured: false,
          createdAt: new Date('2024-06-15'),
          updatedAt: new Date('2024-06-15'),
          authorId: 'user-1',
          categoryId: null,
          viewCount: 0,
          author: { id: 'user-1', username: 'author1' },
          category: null,
          tags: [],
        },
      ];

      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts')
        .query({ fromDate, toDate })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            published: true,
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should return 400 for invalid fromDate format', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ fromDate: 'invalid-date' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid fromDate format');
    });

    it('should return 400 for invalid toDate format', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ toDate: 'invalid-date' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid toDate format');
    });

    it('should return 400 if fromDate is after toDate', async () => {
      const response = await request(app)
        .get('/api/posts')
        .query({ fromDate: '2024-12-31', toDate: '2024-01-01' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('fromDate must be earlier than or equal to toDate');
    });

    it('should accept ISO 8601 date format', async () => {
      const fromDate = '2024-01-01T00:00:00Z';
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/posts')
        .query({ fromDate })
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should combine date range filter with other filters', async () => {
      const fromDate = '2024-01-01';
      const toDate = '2024-12-31';
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Filtered Post',
          content: 'Content',
          slug: 'filtered-post',
          published: true,
          featured: false,
          createdAt: new Date('2024-06-15'),
          updatedAt: new Date('2024-06-15'),
          authorId: 'user-1',
          categoryId: 'cat-1',
          viewCount: 0,
          author: { id: 'user-1', username: 'author1' },
          category: { id: 'cat-1', name: 'Tech', slug: 'tech' },
          tags: [],
        },
      ];

      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts')
        .query({ fromDate, toDate, categoryId: 'cat-1' })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
    });
  });

  describe('Combined Filters', () => {
    it('should filter posts by tag name and date range together', async () => {
      const mockTag = {
        id: 'tag-1',
        name: 'technology',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPosts = [
        {
          id: 'post-1',
          title: 'Tech Post',
          content: 'Content',
          slug: 'tech-post',
          published: true,
          featured: false,
          createdAt: new Date('2024-06-15'),
          updatedAt: new Date('2024-06-15'),
          authorId: 'user-1',
          categoryId: null,
          viewCount: 0,
          author: { id: 'user-1', username: 'author1' },
          category: null,
          tags: [
            {
              tag: { id: 'tag-1', name: 'technology' },
            },
          ],
        },
      ];

      (prismaMock.tag.findFirst as jest.Mock).mockResolvedValue(mockTag);
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockPosts);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/posts')
        .query({
          tag: 'technology',
          fromDate: '2024-01-01',
          toDate: '2024-12-31',
        })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(prismaMock.tag.findFirst).toHaveBeenCalled();
      expect(prismaMock.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: expect.any(Object),
            createdAt: expect.any(Object),
          }),
        })
      );
    });
  });
});

