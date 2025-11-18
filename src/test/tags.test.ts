import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
// Import prisma and app AFTER mocks are set up
import { prisma } from '../lib/prisma';
import app from '../index';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Tags API', () => {
  // Validate that mocking is properly set up
  it('should have mocking properly configured', () => {
    expect(prismaMock.isMocked).toBe(true);
  });

  describe('GET /api/tags', () => {
    it('should return all tags', async () => {

      const mockTags = [
        { id: 'tag-1', name: 'technology', _count: { posts: 5 } },
        { id: 'tag-2', name: 'tutorial', _count: { posts: 3 } },
        { id: 'tag-3', name: 'programming', _count: { posts: 8 } },
      ];

      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue(mockTags);

      // Use supertest to make the request - app is imported with mocked Prisma
      const response = await request(app)
        .get('/api/tags')
        .expect(200);

      expect(response.body).toHaveProperty('tags');
      expect(Array.isArray(response.body.tags)).toBe(true);
      expect(response.body.tags.length).toBe(3);
      // Tags should be sorted alphabetically by default
      expect(response.body.tags[0].name).toBe('programming');
      expect(response.body.tags[1].name).toBe('technology');
      expect(response.body.tags[2].name).toBe('tutorial');
    });
  });

  describe('GET /api/tags?search=keyword', () => {
    it('should return tags matching search keyword', async () => {
      // Mock tags matching "tech" search
      const mockTags = [
        { id: 'tag-1', name: 'technology', _count: { posts: 5 } },
      ];

      // Mock Prisma call with search query
      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue(mockTags);

      const response = await request(app)
        .get('/api/tags')
        .query({ search: 'tech' })
        .expect(200);

      expect(response.body).toHaveProperty('tags');
      expect(Array.isArray(response.body.tags)).toBe(true);

      // Should find "technology" when searching for "tech"
      const hasTechnology = response.body.tags.some((tag: any) => tag.name === 'technology');
      expect(hasTechnology).toBe(true);
    });

    it('should be case insensitive', async () => {
      // Mock tags matching "TECH" search (case insensitive)
      const mockTags = [
        { id: 'tag-1', name: 'technology', _count: { posts: 5 } },
      ];

      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue(mockTags);

      const response = await request(app)
        .get('/api/tags')
        .query({ search: 'TECH' })
        .expect(200);

      // Should find "technology" even with uppercase search
      const hasTechnology = response.body.tags.some((tag: any) => tag.name === 'technology');
      expect(hasTechnology).toBe(true);
    });

    it('should return all tags when search is empty', async () => {
      // Mock all tags for empty search
      const mockAllTags = [
        { id: 'tag-1', name: 'technology', _count: { posts: 5 } },
        { id: 'tag-2', name: 'tutorial', _count: { posts: 3 } },
        { id: 'tag-3', name: 'programming', _count: { posts: 8 } },
      ];

      // First call: all tags (no search)
      // Second call: all tags (empty search)
      (prismaMock.tag.findMany as jest.Mock)
        .mockResolvedValueOnce(mockAllTags)
        .mockResolvedValueOnce(mockAllTags);

      const responseAll = await request(app)
        .get('/api/tags')
        .expect(200);

      const responseEmpty = await request(app)
        .get('/api/tags')
        .query({ search: '' })
        .expect(200);

      expect(responseEmpty.body.tags.length).toBe(responseAll.body.tags.length);
    });
  });

  describe('GET /api/tags?popular=true', () => {
    it('should return tags sorted by post count (most used first)', async () => {
      // Mock tags with post counts
      const mockTagsWithCount = [
        {
          id: 'tag-1',
          name: 'technology',
          _count: { posts: 15 },
        },
        {
          id: 'tag-2',
          name: 'tutorial',
          _count: { posts: 8 },
        },
        {
          id: 'tag-3',
          name: 'programming',
          _count: { posts: 20 },
        },
      ];

      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue(mockTagsWithCount);

      const response = await request(app)
        .get('/api/tags')
        .query({ popular: 'true' })
        .expect(200);

      expect(response.body).toHaveProperty('tags');
      expect(Array.isArray(response.body.tags)).toBe(true);
      expect(response.body.tags.length).toBe(3);

      // Verify tags are sorted by postCount descending
      expect(response.body.tags[0].postCount).toBe(20); // programming (most used)
      expect(response.body.tags[1].postCount).toBe(15); // technology
      expect(response.body.tags[2].postCount).toBe(8); // tutorial (least used)

      // Verify postCount is included in response
      expect(response.body.tags[0]).toHaveProperty('postCount');
      expect(response.body.tags[1]).toHaveProperty('postCount');
      expect(response.body.tags[2]).toHaveProperty('postCount');
    });

    it('should sort tags alphabetically when popular is not true', async () => {
      // Mock tags with post counts
      const mockTagsWithCount = [
        {
          id: 'tag-1',
          name: 'technology',
          _count: { posts: 15 },
        },
        {
          id: 'tag-2',
          name: 'tutorial',
          _count: { posts: 8 },
        },
        {
          id: 'tag-3',
          name: 'programming',
          _count: { posts: 20 },
        },
      ];

      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue(mockTagsWithCount);

      const response = await request(app)
        .get('/api/tags')
        .expect(200);

      expect(response.body).toHaveProperty('tags');
      expect(Array.isArray(response.body.tags)).toBe(true);
      expect(response.body.tags.length).toBe(3);

      // Verify tags are sorted alphabetically by name
      expect(response.body.tags[0].name).toBe('programming');
      expect(response.body.tags[1].name).toBe('technology');
      expect(response.body.tags[2].name).toBe('tutorial');
    });

    it('should sort tags with same post count alphabetically when popular=true', async () => {
      // Mock tags with same post counts
      const mockTagsWithCount = [
        {
          id: 'tag-1',
          name: 'technology',
          _count: { posts: 10 },
        },
        {
          id: 'tag-2',
          name: 'tutorial',
          _count: { posts: 10 },
        },
        {
          id: 'tag-3',
          name: 'programming',
          _count: { posts: 10 },
        },
      ];

      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue(mockTagsWithCount);

      const response = await request(app)
        .get('/api/tags')
        .query({ popular: 'true' })
        .expect(200);

      expect(response.body).toHaveProperty('tags');
      expect(Array.isArray(response.body.tags)).toBe(true);
      expect(response.body.tags.length).toBe(3);

      // Verify tags with same count are sorted alphabetically
      expect(response.body.tags[0].name).toBe('programming');
      expect(response.body.tags[1].name).toBe('technology');
      expect(response.body.tags[2].name).toBe('tutorial');
    });

    it('should work with search and popular parameters together', async () => {
      // Mock tags matching "tech" search with post counts
      const mockTagsWithCount = [
        {
          id: 'tag-1',
          name: 'technology',
          _count: { posts: 15 },
        },
        {
          id: 'tag-4',
          name: 'tech-tips',
          _count: { posts: 5 },
        },
      ];

      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue(mockTagsWithCount);

      const response = await request(app)
        .get('/api/tags')
        .query({ search: 'tech', popular: 'true' })
        .expect(200);

      expect(response.body).toHaveProperty('tags');
      expect(Array.isArray(response.body.tags)).toBe(true);

      // Verify tags are sorted by post count (most used first)
      expect(response.body.tags[0].name).toBe('technology');
      expect(response.body.tags[0].postCount).toBe(15);
      expect(response.body.tags[1].name).toBe('tech-tips');
      expect(response.body.tags[1].postCount).toBe(5);
    });

    it('should include postCount in response even when popular is false', async () => {
      // Mock tags with post counts
      const mockTagsWithCount = [
        {
          id: 'tag-1',
          name: 'technology',
          _count: { posts: 15 },
        },
        {
          id: 'tag-2',
          name: 'tutorial',
          _count: { posts: 8 },
        },
      ];

      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue(mockTagsWithCount);

      const response = await request(app)
        .get('/api/tags')
        .expect(200);

      expect(response.body).toHaveProperty('tags');
      expect(response.body.tags[0]).toHaveProperty('postCount');
      expect(response.body.tags[1]).toHaveProperty('postCount');
    });
  });
});

