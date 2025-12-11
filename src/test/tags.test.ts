import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { invalidateCache } from '../middleware/cache';
// Import prisma and app AFTER mocks are set up
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';

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

  describe('Admin CRUD Operations', () => {
    let adminToken: string;
    let authorToken: string;
    const mockAdmin = {
      id: 'admin-1',
      email: 'admin@example.com',
      username: 'admin',
      role: 'ADMIN' as const,
      deletedAt: null,
    };
    const mockAuthor = {
      id: 'author-1',
      email: 'author@example.com',
      username: 'author',
      role: 'AUTHOR' as const,
      deletedAt: null,
    };

    beforeEach(() => {
      // Clear cache before each test
      invalidateCache.invalidateAll();
      adminToken = generateToken(mockAdmin.id);
      authorToken = generateToken(mockAuthor.id);
    });

    describe('POST /api/tags - Create Tag', () => {
      it('should allow admin to create a new tag', async () => {
        const newTagName = 'new-tag';
        const createdAt = new Date();
        const updatedAt = new Date();

        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Mock: Check if tag exists (should return null)
        (prismaMock.tag.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock: Create tag
        (prismaMock.tag.create as jest.Mock).mockResolvedValue({
          id: 'tag-new',
          name: newTagName.toLowerCase(),
          createdAt,
          updatedAt,
        });

        const response = await request(app)
          .post('/api/tags')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: newTagName })
          .expect(201);

        expect(response.body).toHaveProperty('message', 'Tag created successfully');
        expect(response.body.tag).toHaveProperty('id');
        expect(response.body.tag).toHaveProperty('name', newTagName.toLowerCase());
        expect(response.body.tag).toHaveProperty('createdAt');
        expect(response.body.tag).toHaveProperty('updatedAt');

        // Verify Prisma was called correctly
        expect(prismaMock.tag.findUnique).toHaveBeenCalledWith({
          where: { name: newTagName.toLowerCase() },
        });
        expect(prismaMock.tag.create).toHaveBeenCalledWith({
          data: {
            name: newTagName.toLowerCase(),
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });

      it('should trim and lowercase tag name', async () => {
        const newTagName = '  NEW-TAG  ';
        const createdAt = new Date();
        const updatedAt = new Date();

        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Mock: Check if tag exists
        (prismaMock.tag.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock: Create tag
        (prismaMock.tag.create as jest.Mock).mockResolvedValue({
          id: 'tag-new',
          name: 'new-tag',
          createdAt,
          updatedAt,
        });

        const response = await request(app)
          .post('/api/tags')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: newTagName })
          .expect(201);

        expect(response.body.tag.name).toBe('new-tag');
        expect(prismaMock.tag.create).toHaveBeenCalledWith({
          data: {
            name: 'new-tag',
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });

      it('should return 409 when tag already exists', async () => {
        const existingTagName = 'existing-tag';

        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Mock: Tag already exists
        (prismaMock.tag.findUnique as jest.Mock).mockResolvedValue({
          id: 'tag-existing',
          name: existingTagName,
        });

        const response = await request(app)
          .post('/api/tags')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: existingTagName })
          .expect(409);

        expect(response.body.error).toBe('Tag already exists');
        expect(response.body.message).toBe('A tag with this name already exists');
        expect(prismaMock.tag.create).not.toHaveBeenCalled();
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/tags')
          .send({ name: 'new-tag' })
          .expect(401);

        expect(response.status).toBe(401);
      });

      it('should require admin role', async () => {
        // Mock auth user lookup for author
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAuthor.id) {
            return Promise.resolve(mockAuthor);
          }
          return Promise.resolve(null);
        });

        const response = await request(app)
          .post('/api/tags')
          .set('Authorization', `Bearer ${authorToken}`)
          .send({ name: 'new-tag' })
          .expect(403);

        expect(response.body).toHaveProperty('error', 'ForbiddenError');
        expect(response.body.message).toContain('Access denied');
        expect(prismaMock.tag.create).not.toHaveBeenCalled();
      });

      it('should validate tag name length', async () => {
        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Test with empty name
        const response1 = await request(app)
          .post('/api/tags')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: '' })
          .expect(400);

        expect(response1.body).toHaveProperty('error', 'ValidationError');
        expect(response1.body).toHaveProperty('details');
        expect(Array.isArray(response1.body.details)).toBe(true);

        // Test with name too long
        const longName = 'a'.repeat(51);
        const response2 = await request(app)
          .post('/api/tags')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: longName })
          .expect(400);

        expect(response2.body).toHaveProperty('error', 'ValidationError');
        expect(response2.body).toHaveProperty('details');
        expect(Array.isArray(response2.body.details)).toBe(true);
      });

      it('should validate tag name format', async () => {
        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Test with invalid characters
        const response = await request(app)
          .post('/api/tags')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'tag@with#special!chars' })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'ValidationError');
        expect(response.body).toHaveProperty('details');
        expect(Array.isArray(response.body.details)).toBe(true);
      });
    });

    describe('PUT /api/tags/:tagId - Update Tag', () => {
      it('should allow admin to update a tag', async () => {
        const tagId = 'tag-1';
        const oldName = 'old-tag';
        const newName = 'updated-tag';
        const createdAt = new Date('2024-01-01');
        const updatedAt = new Date();

        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Mock: Tag exists
        (prismaMock.tag.findUnique as jest.Mock)
          .mockResolvedValueOnce({
            id: tagId,
            name: oldName,
          })
          .mockResolvedValueOnce(null); // No duplicate tag

        // Mock: Update tag
        (prismaMock.tag.update as jest.Mock).mockResolvedValue({
          id: tagId,
          name: newName.toLowerCase(),
          createdAt,
          updatedAt,
        });

        const response = await request(app)
          .put(`/api/tags/${tagId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: newName })
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Tag updated successfully');
        expect(response.body.tag).toHaveProperty('id', tagId);
        expect(response.body.tag).toHaveProperty('name', newName.toLowerCase());
        expect(response.body.tag).toHaveProperty('updatedAt');

        // Verify Prisma was called correctly
        expect(prismaMock.tag.findUnique).toHaveBeenCalledWith({
          where: { id: tagId },
        });
        expect(prismaMock.tag.update).toHaveBeenCalledWith({
          where: { id: tagId },
          data: {
            name: newName.toLowerCase(),
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });

      it('should return 404 when tag does not exist', async () => {
        const nonExistentTagId = 'non-existent-tag';

        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Mock: Tag does not exist
        (prismaMock.tag.findUnique as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .put(`/api/tags/${nonExistentTagId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'new-name' })
          .expect(404);

        expect(response.body.error).toBe('Tag not found');
        expect(response.body.message).toBe('The specified tag does not exist');
        expect(prismaMock.tag.update).not.toHaveBeenCalled();
      });

      it('should return 409 when new name conflicts with existing tag', async () => {
        const tagId = 'tag-1';
        const existingTagName = 'existing-tag';
        const conflictingTagId = 'tag-2';

        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Mock: Tag exists
        (prismaMock.tag.findUnique as jest.Mock)
          .mockResolvedValueOnce({
            id: tagId,
            name: 'old-tag',
          })
          .mockResolvedValueOnce({
            id: conflictingTagId,
            name: existingTagName,
          }); // Duplicate tag exists

        const response = await request(app)
          .put(`/api/tags/${tagId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: existingTagName })
          .expect(409);

        expect(response.body.error).toBe('Tag name already exists');
        expect(response.body.message).toBe('Another tag with this name already exists');
        expect(prismaMock.tag.update).not.toHaveBeenCalled();
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .put('/api/tags/tag-1')
          .send({ name: 'new-name' })
          .expect(401);

        expect(response.status).toBe(401);
      });

      it('should require admin role', async () => {
        // Mock auth user lookup for author
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAuthor.id) {
            return Promise.resolve(mockAuthor);
          }
          return Promise.resolve(null);
        });

        const response = await request(app)
          .put('/api/tags/tag-1')
          .set('Authorization', `Bearer ${authorToken}`)
          .send({ name: 'new-name' })
          .expect(403);

        expect(response.body).toHaveProperty('error', 'ForbiddenError');
        expect(prismaMock.tag.update).not.toHaveBeenCalled();
      });
    });

    describe('DELETE /api/tags/:tagId - Delete Tag', () => {
      it('should allow admin to delete a tag', async () => {
        const tagId = 'tag-1';
        const tagName = 'tag-to-delete';
        const postsCount = 5;

        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Mock: Tag exists with posts
        (prismaMock.tag.findUnique as jest.Mock).mockResolvedValue({
          id: tagId,
          name: tagName,
          _count: {
            posts: postsCount,
          },
        });

        // Mock: Delete tag
        (prismaMock.tag.delete as jest.Mock).mockResolvedValue({
          id: tagId,
          name: tagName,
        });

        const response = await request(app)
          .delete(`/api/tags/${tagId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Tag deleted successfully');
        expect(response.body.tag).toHaveProperty('id', tagId);
        expect(response.body.tag).toHaveProperty('name', tagName);
        expect(response.body).toHaveProperty('deletedPostsCount', postsCount);

        // Verify Prisma was called correctly
        expect(prismaMock.tag.findUnique).toHaveBeenCalledWith({
          where: { id: tagId },
          include: {
            _count: {
              select: {
                posts: true,
              },
            },
          },
        });
        expect(prismaMock.tag.delete).toHaveBeenCalledWith({
          where: { id: tagId },
        });
      });

      it('should return 404 when tag does not exist', async () => {
        const nonExistentTagId = 'non-existent-tag';

        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Mock: Tag does not exist
        (prismaMock.tag.findUnique as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .delete(`/api/tags/${nonExistentTagId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        expect(response.body.error).toBe('Tag not found');
        expect(response.body.message).toBe('The specified tag does not exist');
        expect(prismaMock.tag.delete).not.toHaveBeenCalled();
      });

      it('should handle tag with no posts', async () => {
        const tagId = 'tag-1';
        const tagName = 'tag-no-posts';

        // Mock auth user lookup
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAdmin.id) {
            return Promise.resolve(mockAdmin);
          }
          return Promise.resolve(null);
        });

        // Mock: Tag exists with no posts
        (prismaMock.tag.findUnique as jest.Mock).mockResolvedValue({
          id: tagId,
          name: tagName,
          _count: {
            posts: 0,
          },
        });

        // Mock: Delete tag
        (prismaMock.tag.delete as jest.Mock).mockResolvedValue({
          id: tagId,
          name: tagName,
        });

        const response = await request(app)
          .delete(`/api/tags/${tagId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.deletedPostsCount).toBe(0);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .delete('/api/tags/tag-1')
          .expect(401);

        expect(response.status).toBe(401);
      });

      it('should require admin role', async () => {
        // Mock auth user lookup for author
        (prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
          if (args?.where?.id === mockAuthor.id) {
            return Promise.resolve(mockAuthor);
          }
          return Promise.resolve(null);
        });

        const response = await request(app)
          .delete('/api/tags/tag-1')
          .set('Authorization', `Bearer ${authorToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error', 'ForbiddenError');
        expect(prismaMock.tag.delete).not.toHaveBeenCalled();
      });
    });
  });
});

