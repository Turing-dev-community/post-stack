import { Router } from 'express';
import { getSitemap } from '../controllers/sitemapController';
import { asyncHandler } from '../middleware/validation';

const router = Router();

router.get('/sitemap.xml', asyncHandler(getSitemap));

export default router;
