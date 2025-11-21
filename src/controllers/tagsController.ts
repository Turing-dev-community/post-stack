import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/validation';
import { getTags as getTagsService, createTag as createTagService, updateTag as updateTagService, deleteTag as deleteTagService } from '../services/tagsService';

export const getTags = asyncHandler(async (req: Request, res: Response) => {
  const searchQuery = req.query.search as string | undefined;
  const popular = req.query.popular === 'true';

  const tags = await getTagsService(searchQuery, popular);

  return res.json({
    tags,
  });
});

export const createTag = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;

  try {
    const tag = await createTagService(name);

    return res.status(201).json({
      message: 'Tag created successfully',
      tag,
    });
  } catch (error: any) {
    if (error.message === 'Tag already exists') {
      return res.status(409).json({
        error: 'Tag already exists',
        message: 'A tag with this name already exists',
      });
    }
    throw error;
  }
});

export const updateTag = asyncHandler(async (req: Request, res: Response) => {
  const { tagId } = req.params;
  const { name } = req.body;

  try {
    const tag = await updateTagService(tagId, name);

    return res.json({
      message: 'Tag updated successfully',
      tag,
    });
  } catch (error: any) {
    if (error.message === 'Tag not found') {
      return res.status(404).json({
        error: 'Tag not found',
        message: 'The specified tag does not exist',
      });
    }
    if (error.message === 'Tag name already exists') {
      return res.status(409).json({
        error: 'Tag name already exists',
        message: 'Another tag with this name already exists',
      });
    }
    throw error;
  }
});

export const deleteTag = asyncHandler(async (req: Request, res: Response) => {
  const { tagId } = req.params;

  try {
    const result = await deleteTagService(tagId);

    return res.json({
      message: 'Tag deleted successfully',
      tag: {
        id: result.id,
        name: result.name,
      },
      deletedPostsCount: result.deletedPostsCount,
    });
  } catch (error: any) {
    if (error.message === 'Tag not found') {
      return res.status(404).json({
        error: 'Tag not found',
        message: 'The specified tag does not exist',
      });
    }
    throw error;
  }
});

