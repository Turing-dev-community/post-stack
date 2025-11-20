import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { invalidateCache } from '../middleware/cache';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('GET /api/posts/popular', () => {
  // Validate that mocking is properly set up
  it('should have mocking properly configured', () => {
    expect(prismaMock.isMocked).toBe(true);
  });

  const userId = 'user-1';
  const categoryId = 'cat-1';
  const tagId = 'tag-1';

  beforeEach(() => {
    // Clear all mocks before each test to ensure isolation
    jest.clearAllMocks();
    // Clear cache to prevent test interference
    invalidateCache.invalidateAll();
  });

  describe('Popular Posts API', () => {
    it('should return posts sorted by like count (most liked first)', async () => {
      // Mock $queryRaw for sorted post IDs with like counts
      const mockPostIdsWithLikes = [
        { id: 'post-2', likeCount: 10 },
        { id: 'post-1', likeCount: 5 },
        { id: 'post-3', likeCount: 2 },
      ];
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce(mockPostIdsWithLikes);

      // Mock $queryRaw for total count
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(3) }]);

      // Mock findMany for full post data
      const mockPosts = [
        {
          id: 'post-2',
          title: 'Post with 10 likes',
          content: '# Content 2',
          slug: 'post-10-likes',
          published: true,
          authorId: userId,
          categoryId: null,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          viewCount: 0,
          featured: false,
          author: {
            id: userId,
            username: 'testuser',
          },
          category: null,
          tags: [],
        },
        {
          id: 'post-1',
          title: 'Post with 5 likes',
          content: '# Content 1',
          slug: 'post-5-likes',
          published: true,
          authorId: userId,
          categoryId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          viewCount: 0,
          featured: false,
          author: {
            id: userId,
            username: 'testuser',
          },
          category: null,
          tags: [],
        },
        {
          id: 'post-3',
          title: 'Post with 2 likes',
          content: '# Content 3',
          slug: 'post-2-likes',
          published: true,
          authorId: userId,
          categoryId: null,
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
          viewCount: 0,
          featured: false,
          author: {
            id: userId,
            username: 'testuser',
          },
          category: null,
          tags: [],
        },
      ];
      (prismaMock.post.findMany as jest.Mock).mockResolvedValueOnce(mockPosts);

      const response = await request(app)
        .get('/api/posts/popular')
        .query({ limit: 50 })
        .expect(200);

      expect(response.body).toHaveProperty('posts');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.posts)).toBe(true);

      // Find our posts
      const postWith10Likes = response.body.posts.find(
        (p: any) => p.slug === 'post-10-likes'
      );
      const postWith5Likes = response.body.posts.find(
        (p: any) => p.slug === 'post-5-likes'
      );
      const postWith2Likes = response.body.posts.find(
        (p: any) => p.slug === 'post-2-likes'
      );

      expect(postWith10Likes).toBeDefined();
      expect(postWith5Likes).toBeDefined();
      expect(postWith2Likes).toBeDefined();

      // Check like counts
      expect(postWith10Likes.likeCount).toBe(10);
      expect(postWith5Likes.likeCount).toBe(5);
      expect(postWith2Likes.likeCount).toBe(2);

      // Check ordering (most liked first)
      const post10Index = response.body.posts.findIndex(
        (p: any) => p.slug === 'post-10-likes'
      );
      const post5Index = response.body.posts.findIndex(
        (p: any) => p.slug === 'post-5-likes'
      );
      const post2Index = response.body.posts.findIndex(
        (p: any) => p.slug === 'post-2-likes'
      );

      expect(post10Index).toBeLessThan(post5Index);
      expect(post5Index).toBeLessThan(post2Index);
    });

    it('should only return published posts', async () => {
      // Mock $queryRaw for sorted post IDs with like counts
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([
        { id: 'post-1', likeCount: 1 },
      ]);

      // Mock $queryRaw for total count
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(1) }]);

      // Mock findMany for full post data
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Published Post',
          content: '# Published Content',
          slug: 'published-post',
          published: true,
          authorId: userId,
          categoryId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          viewCount: 0,
          featured: false,
          author: {
            id: userId,
            username: 'testuser',
          },
          category: null,
          tags: [],
        },
      ];
      (prismaMock.post.findMany as jest.Mock).mockResolvedValueOnce(mockPosts);

      const response = await request(app)
        .get('/api/posts/popular')
        .expect(200);

      expect(response.body.posts.every((p: any) => p.published === true)).toBe(true);
      expect(
        response.body.posts.some((p: any) => p.slug === 'published-post')
      ).toBe(true);
      expect(
        response.body.posts.every((p: any) => p.slug !== 'unpublished-post')
      ).toBe(true);
    });

    it('should include likeCount, author, category, and tags in response', async () => {
      // Mock $queryRaw for sorted post IDs with like counts
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([
        { id: 'post-1', likeCount: 1 },
      ]);

      // Mock $queryRaw for total count
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(1) }]);

      const mockCategory = {
        id: categoryId,
        name: 'Technology',
        slug: 'technology',
      };

      const mockTag = {
        id: tagId,
        name: 'programming',
      };

      // Mock findMany for full post data
      const mockPosts = [
        {
          id: 'post-1',
          title: 'Test Post',
          content: '# Test Content',
          slug: 'test-post-popular',
          published: true,
          authorId: userId,
          categoryId: categoryId,
          createdAt: new Date(),
          updatedAt: new Date(),
          viewCount: 0,
          featured: false,
          author: {
            id: userId,
            username: 'testuser',
          },
          category: mockCategory,
          tags: [
            {
              tag: mockTag,
            },
          ],
        },
      ];

      (prismaMock.post.findMany as jest.Mock).mockResolvedValueOnce(mockPosts);

      const response = await request(app)
        .get('/api/posts/popular')
        .query({ limit: 100 })
        .expect(200);

      const testPost = response.body.posts.find(
        (p: any) => p.slug === 'test-post-popular'
      );

      expect(testPost).toBeDefined();
      expect(testPost).toHaveProperty('likeCount', 1);
      expect(testPost).toHaveProperty('author');
      expect(testPost.author).toHaveProperty('id');
      expect(testPost.author).toHaveProperty('username');
      expect(testPost).toHaveProperty('category');
      expect(testPost.category).toHaveProperty('id', categoryId);
      expect(testPost.category).toHaveProperty('name', 'Technology');
      expect(testPost).toHaveProperty('tags');
      expect(Array.isArray(testPost.tags)).toBe(true);
      expect(testPost.tags.length).toBe(1);
      expect(testPost.tags[0]).toHaveProperty('id', tagId);
      expect(testPost.tags[0]).toHaveProperty('name', 'programming');
    });

    it('should handle posts with same like count (sort by createdAt)', async () => {
      const olderDate = new Date('2024-01-01');
      const newerDate = new Date('2024-01-05');

      // Mock $queryRaw for sorted post IDs with like counts (newer first due to createdAt DESC)
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([
        { id: 'post-newer', likeCount: 50 },
        { id: 'post-older', likeCount: 50 },
      ]);

      // Mock $queryRaw for total count
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(2) }]);

      // Mock findMany for full post data
      const mockPosts = [
        {
          id: 'post-newer',
          title: 'Newer Post',
          content: '# Newer Content',
          slug: 'newer-post',
          published: true,
          authorId: userId,
          categoryId: null,
          createdAt: newerDate,
          updatedAt: newerDate,
          viewCount: 0,
          featured: false,
          author: {
            id: userId,
            username: 'testuser',
          },
          category: null,
          tags: [],
        },
        {
          id: 'post-older',
          title: 'Older Post',
          content: '# Older Content',
          slug: 'older-post',
          published: true,
          authorId: userId,
          categoryId: null,
          createdAt: olderDate,
          updatedAt: olderDate,
          viewCount: 0,
          featured: false,
          author: {
            id: userId,
            username: 'testuser',
          },
          category: null,
          tags: [],
        },
      ];

      (prismaMock.post.findMany as jest.Mock).mockResolvedValueOnce(mockPosts);

      const response = await request(app)
        .get('/api/posts/popular')
        .query({ limit: 100 })
        .expect(200);

      expect(response.body.posts.length).toBeGreaterThanOrEqual(2);

      const olderPostIndex = response.body.posts.findIndex(
        (p: any) => p.slug === 'older-post'
      );
      const newerPostIndex = response.body.posts.findIndex(
        (p: any) => p.slug === 'newer-post'
      );

      // Both posts should be found
      expect(olderPostIndex).toBeGreaterThanOrEqual(0);
      expect(newerPostIndex).toBeGreaterThanOrEqual(0);

      // Newer post should come before older post (both have 50 likes)
      expect(newerPostIndex).toBeLessThan(olderPostIndex);
    });

    it('should support pagination', async () => {
      // Mock $queryRaw for sorted post IDs with like counts (page 2, limit 5)
      // Posts 6-10 (with like counts 10, 9, 8, 7, 6)
      const mockPostIdsWithLikes = [];
      for (let i = 5; i < 10; i++) {
        mockPostIdsWithLikes.push({
          id: `post-${i + 1}`,
          likeCount: 15 - i,
        });
      }
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce(mockPostIdsWithLikes);

      // Mock $queryRaw for total count
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(15) }]);

      // Mock findMany for full post data (page 2: posts 6-10)
      const mockPosts = [];
      for (let i = 5; i < 10; i++) {
        mockPosts.push({
          id: `post-${i + 1}`,
          title: `Post ${i + 1}`,
          content: `# Content ${i + 1}`,
          slug: `post-${i + 1}`,
          published: true,
          authorId: userId,
          categoryId: null,
          createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
          updatedAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
          viewCount: 0,
          featured: false,
          author: {
            id: userId,
            username: 'testuser',
          },
          category: null,
          tags: [],
        });
      }

      (prismaMock.post.findMany as jest.Mock).mockResolvedValueOnce(mockPosts);

      const response = await request(app)
        .get('/api/posts/popular')
        .query({ page: 2, limit: 5 })
        .expect(200);

      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.posts).toHaveLength(5);
      expect(response.body.pagination.total).toBe(15);
    });

    it('should return empty array when no posts exist', async () => {
      // Mock $queryRaw for sorted post IDs (empty)
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

      // Mock $queryRaw for total count (0)
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(0) }]);

      const response = await request(app)
        .get('/api/posts/popular')
        .expect(200);

      expect(response.body).toHaveProperty('posts');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.posts)).toBe(true);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('pages');
      // When mocked to return empty, the response should have empty posts
      expect(response.body.posts).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });

    it('should include posts with 0 likes (sorted last)', async () => {
      // Mock $queryRaw for sorted post IDs with like counts (post with likes first, then post without)
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([
        { id: 'post-with-likes', likeCount: 50 },
        { id: 'post-without-likes', likeCount: 0 },
      ]);

      // Mock $queryRaw for total count
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(2) }]);

      // Mock findMany for full post data
      const mockPosts = [
        {
          id: 'post-with-likes',
          title: 'Post with Likes',
          content: '# Content',
          slug: 'post-with-likes',
          published: true,
          authorId: userId,
          categoryId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          viewCount: 0,
          featured: false,
          author: {
            id: userId,
            username: 'testuser',
          },
          category: null,
          tags: [],
        },
        {
          id: 'post-without-likes',
          title: 'Post without Likes',
          content: '# Content',
          slug: 'post-without-likes',
          published: true,
          authorId: userId,
          categoryId: null,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          viewCount: 0,
          featured: false,
          author: {
            id: userId,
            username: 'testuser',
          },
          category: null,
          tags: [],
        },
      ];

      (prismaMock.post.findMany as jest.Mock).mockResolvedValueOnce(mockPosts);

      const response = await request(app)
        .get('/api/posts/popular')
        .query({ limit: 100 })
        .expect(200);

      expect(response.body.posts.length).toBeGreaterThanOrEqual(2);

      const postWithLikesIndex = response.body.posts.findIndex(
        (p: any) => p.slug === 'post-with-likes'
      );
      const postWithoutLikesIndex = response.body.posts.findIndex(
        (p: any) => p.slug === 'post-without-likes'
      );

      // Both posts should be found
      expect(postWithLikesIndex).toBeGreaterThanOrEqual(0);
      expect(postWithoutLikesIndex).toBeGreaterThanOrEqual(0);

      // Post with likes should come before post without likes
      expect(postWithLikesIndex).toBeLessThan(postWithoutLikesIndex);

      // Verify like counts
      const postWithLikesData = response.body.posts.find(
        (p: any) => p.slug === 'post-with-likes'
      );
      const postWithoutLikesData = response.body.posts.find(
        (p: any) => p.slug === 'post-without-likes'
      );

      expect(postWithLikesData.likeCount).toBe(50);
      expect(postWithoutLikesData.likeCount).toBe(0);
    });

    it('should validate pagination parameters', async () => {
      // Test invalid page
      const response1 = await request(app)
        .get('/api/posts/popular')
        .query({ page: 0 })
        .expect(400);

      // Test invalid limit
      const response2 = await request(app)
        .get('/api/posts/popular')
        .query({ limit: 0 })
        .expect(400);

      // Test limit too high
      const response3 = await request(app)
        .get('/api/posts/popular')
        .query({ limit: 101 })
        .expect(400);
    });
  });
});
