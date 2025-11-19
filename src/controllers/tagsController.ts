import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/validation';
import { getTags as getTagsService } from '../services/tagsService';

export const getTags = asyncHandler(async (req: Request, res: Response) => {
  const searchQuery = req.query.search as string | undefined;
  const popular = req.query.popular === 'true';

  const tags = await getTagsService(searchQuery, popular);

  return res.json({
    tags,
  });
});

