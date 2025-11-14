import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/validation';

const router = Router();

router.get('/', asyncHandler(async (req: any, res: Response) => {
  const searchQuery = req.query.search as string;

  const whereClause: any = {};

  if (searchQuery && searchQuery.trim()) {
    whereClause.name = {
      contains: searchQuery.trim(),
      mode: 'insensitive',
    };
  }

  const tags = await prisma.tag.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return res.json({
    tags,
  });
}));

export default router;

