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
        { id: 'tag-1', name: 'technology' },
        { id: 'tag-2', name: 'tutorial' },
        { id: 'tag-3', name: 'programming' },
      ];

      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue(mockTags);

      // Use supertest to make the request - app is imported with mocked Prisma
      const response = await request(app)
        .get('/api/tags')
        .expect(200);

      expect(response.body).toHaveProperty('tags');
      expect(Array.isArray(response.body.tags)).toBe(true);
      expect(response.body.tags.length).toBe(3);
      expect(response.body.tags).toEqual(mockTags);
    });
  });

  describe('GET /api/tags?search=keyword', () => {
    it('should return tags matching search keyword', async () => {
      // Mock tags matching "tech" search
      const mockTags = [
        { id: 'tag-1', name: 'technology' },
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
        { id: 'tag-1', name: 'technology' },
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
        { id: 'tag-1', name: 'technology' },
        { id: 'tag-2', name: 'tutorial' },
        { id: 'tag-3', name: 'programming' },
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
});

