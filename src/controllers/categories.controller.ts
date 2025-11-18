import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class CategoriesController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getAllCategories(req: Request, res: Response): Promise<Response> {
    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.json({
      categories,
    });
  }
}

