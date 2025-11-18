import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as categoriesController from './categoriesController';
import { setupPrismaMock, MockedPrismaClient } from '../test/utils/mockPrisma';
import { mockDeep } from 'jest-mock-extended';

// Mock the prisma module BEFORE importing
jest.mock('../lib/prisma', () => {
  const { PrismaClient } = require('@prisma/client');
  return {
    __esModule: true,
    prisma: mockDeep(PrismaClient),
  };
});

// Import prisma AFTER mocks are set up
import { prisma } from '../lib/prisma';

// Setup Prisma mock at the top level (before describe block)
const { prisma: prismaMock } = setupPrismaMock(prisma, {} as any);

describe('CategoriesController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {

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

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await categoriesController.getAllCategories(mockRequest as Request, mockResponse as Response);

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

      expect(jsonMock).toHaveBeenCalledWith({
        categories: mockCategories,
      });

      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return empty array when no categories exist', async () => {
      (prismaMock.category.findMany as jest.Mock).mockResolvedValue([]);

      await categoriesController.getAllCategories(mockRequest as Request, mockResponse as Response);

      expect(prismaMock.category.findMany).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        categories: [],
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      (prismaMock.category.findMany as jest.Mock).mockRejectedValue(error);

      await expect(
        categoriesController.getAllCategories(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Database connection failed');

      expect(prismaMock.category.findMany).toHaveBeenCalled();
    });

    it('should return categories in ascending order by name', async () => {
      const mockCategories = [
        { id: '1', name: 'A Category', slug: 'a-category' },
        { id: '2', name: 'B Category', slug: 'b-category' },
        { id: '3', name: 'C Category', slug: 'c-category' },
      ];

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await categoriesController.getAllCategories(mockRequest as Request, mockResponse as Response);

      expect(prismaMock.category.findMany).toHaveBeenCalledWith(
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

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await categoriesController.getAllCategories(mockRequest as Request, mockResponse as Response);

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

    it('should return the response object', async () => {
      const mockCategories = [
        { id: '1', name: 'Test', slug: 'test' },
      ];

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      const result = await categoriesController.getAllCategories(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(result).toBe(mockResponse);
    });
  });
});

