import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * Get all categories
 * Returns a list of all categories sorted by name
 */
export async function getAllCategories(req: Request, res: Response): Promise<Response> {
  const categories = await prisma.category.findMany({
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

