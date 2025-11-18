import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { CategoriesController } from './categories.controller';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let mockPrisma: DeepMockProxy<PrismaClient>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Create a mock Prisma client
    mockPrisma = mockDeep<PrismaClient>();
    controller = new CategoriesController(mockPrisma as unknown as PrismaClient);

    // Setup mock response
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    mockResponse = {
      json: jsonMock,
      status: statusMock,
    } as Partial<Response>;

    mockRequest = {};
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllCategories', () => {
    it('should return all categories sorted by name', async () => {
      const mockCategories = [
        { id: '1', name: 'Lifestyle', slug: 'lifestyle' },
        { id: '2', name: 'News', slug: 'news' },
        { id: '3', name: 'Technology', slug: 'technology' },
      ];

      (mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await controller.getAllCategories(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      expect(jsonMock).toHaveBeenCalledWith({
        categories: mockCategories,
      });

      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return empty array when no categories exist', async () => {
      (mockPrisma.category.findMany as jest.Mock).mockResolvedValue([]);

      await controller.getAllCategories(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.category.findMany).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        categories: [],
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      (mockPrisma.category.findMany as jest.Mock).mockRejectedValue(error);

      await expect(
        controller.getAllCategories(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Database connection failed');

      expect(mockPrisma.category.findMany).toHaveBeenCalled();
    });

    it('should return categories in ascending order by name', async () => {
      const mockCategories = [
        { id: '1', name: 'A Category', slug: 'a-category' },
        { id: '2', name: 'B Category', slug: 'b-category' },
        { id: '3', name: 'C Category', slug: 'c-category' },
      ];

      (mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await controller.getAllCategories(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            name: 'asc',
          },
        })
      );
    });

    it('should only return id, name, and slug fields', async () => {
      const mockCategories = [
        { id: '1', name: 'Test', slug: 'test' },
      ];

      (mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await controller.getAllCategories(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            name: true,
            slug: true,
          },
        })
      );
    });

    it('should return the response object', async () => {
      const mockCategories = [
        { id: '1', name: 'Test', slug: 'test' },
      ];

      (mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      const result = await controller.getAllCategories(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(result).toBe(mockResponse);
    });
  });
});

