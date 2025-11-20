import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Categories API', () => {
  // Validate that mocking is properly set up
  it('should have mocking properly configured', () => {
    expect(prismaMock.isMocked).toBe(true);
  });

  describe('GET /api/categories', () => {
    it('should return all categories', async () => {
      const mockCategories = [
        { id: '1', name: 'Technology', slug: 'technology' },
        { id: '2', name: 'Tutorial', slug: 'tutorial' },
        { id: '3', name: 'Lifestyle', slug: 'lifestyle' },
      ];

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      // Use supertest to make the request - app is imported with mocked Prisma
      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(response.body.categories.length).toBe(3);
      expect(response.body.categories).toEqual(mockCategories);

      // Verify Prisma was called correctly
      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    });

    it('should not require authentication', async () => {
      const mockCategories = [
        { id: '1', name: 'News', slug: 'news' },
      ];

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await request(app)
        .get('/api/categories')
        .expect(200);
    });

    it('should return empty array when no categories exist', async () => {
      (prismaMock.category.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      expect(response.body.categories).toEqual([]);
      expect(Array.isArray(response.body.categories)).toBe(true);
    });

    it('should contain exactly the predefined categories', async () => {
      const expectedCategories = [
        { id: '1', name: 'Technology', slug: 'technology' },
        { id: '2', name: 'Tutorial', slug: 'tutorial' },
        { id: '3', name: 'Lifestyle', slug: 'lifestyle' },
        { id: '4', name: 'Review', slug: 'review' },
        { id: '5', name: 'News', slug: 'news' },
        { id: '6', name: 'Opinion', slug: 'opinion' },
        { id: '7', name: 'Tips & Tricks', slug: 'tips-tricks' },
      ];

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(expectedCategories);

      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      const actualCategoryNames = response.body.categories.map((cat: any) => cat.name).sort();
      const expectedCategoryNames = expectedCategories.map(cat => cat.name).sort();

      expect(actualCategoryNames).toHaveLength(expectedCategories.length);
      expect(actualCategoryNames).toEqual(expectedCategoryNames);

      // Verify each category has required fields
      response.body.categories.forEach((category: any) => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('slug');
        expect(typeof category.id).toBe('string');
        expect(typeof category.name).toBe('string');
        expect(typeof category.slug).toBe('string');
        expect(category.name.length).toBeGreaterThan(0);
        expect(category.slug.length).toBeGreaterThan(0);
      });
    });

    it('should return categories sorted by name in ascending order', async () => {
      const mockCategories = [
        { id: '3', name: 'Lifestyle', slug: 'lifestyle' },
        { id: '5', name: 'News', slug: 'news' },
        { id: '1', name: 'Technology', slug: 'technology' },
      ];

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await request(app)
        .get('/api/categories')
        .expect(200);

      // Verify the orderBy parameter was passed correctly
      expect(prismaMock.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            name: 'asc',
          },
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      (prismaMock.category.findMany as jest.Mock).mockRejectedValue(error);

      const response = await request(app)
        .get('/api/categories')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should only return id, name, and slug fields', async () => {
      const mockCategories = [
        { id: '1', name: 'Test', slug: 'test' },
      ];

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await request(app)
        .get('/api/categories')
        .expect(200);

      // Verify only specific fields are selected
      expect(prismaMock.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            name: true,
            slug: true,
          },
        })
      );
    });

    it('should return correct response structure', async () => {
      const mockCategories = [
        { id: '1', name: 'Technology', slug: 'technology' },
        { id: '2', name: 'News', slug: 'news' },
      ];

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('categories');
      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(response.body.categories.length).toBe(2);
      
      // Verify each category has the correct structure
      response.body.categories.forEach((category: any) => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('slug');
        expect(Object.keys(category).length).toBe(3); // Only id, name, slug
      });
    });

    it('should handle large number of categories', async () => {
      const mockCategories = Array.from({ length: 100 }, (_, i) => ({
        id: `cat-${i + 1}`,
        name: `Category ${i + 1}`,
        slug: `category-${i + 1}`,
      }));

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      expect(response.body.categories).toHaveLength(100);
      expect(response.body.categories[0]).toHaveProperty('id');
      expect(response.body.categories[0]).toHaveProperty('name');
      expect(response.body.categories[0]).toHaveProperty('slug');
    });

    it('should maintain consistent response format across multiple requests', async () => {
      const mockCategories = [
        { id: '1', name: 'Technology', slug: 'technology' },
      ];

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      const response1 = await request(app)
        .get('/api/categories')
        .expect(200);

      const response2 = await request(app)
        .get('/api/categories')
        .expect(200);

      // Both responses should have the same structure
      expect(response1.body).toHaveProperty('categories');
      expect(response2.body).toHaveProperty('categories');
      expect(Array.isArray(response1.body.categories)).toBe(true);
      expect(Array.isArray(response2.body.categories)).toBe(true);
    });


    // test by dynamically importing the controller
    it('should dynamically import the controller', async () => {
      const controller = await import('../controllers/categoriesController');
      expect(controller.getAllCategories).toBeDefined();
    });
  });
});
