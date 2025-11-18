import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/validation';
import { CategoriesController } from '../controllers/categories.controller';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest, generateSlug } from '../utils/auth';
import { requireAdmin } from '../middleware/authorization';

const router = Router();
const categoriesController = new CategoriesController(prisma);

router.get('/', asyncHandler(
  (req: Request, res: Response) => categoriesController.getAllCategories(req, res)
));

// Admin-only route: Create category
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Category name is required',
      });
    }

    const slug = generateSlug(name);

    // Check if category with same name or slug already exists
    const existingCategory = await prisma.category.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });

    if (existingCategory) {
      return res.status(409).json({
        error: 'Category already exists',
        message: existingCategory.name === name
          ? 'A category with this name already exists'
          : 'A category with this slug already exists',
      });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      message: 'Category created successfully',
      category,
    });
  })
);

export default router;
