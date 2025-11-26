import { Router } from 'express';
import { getSitemap, getRssFeed } from '../controllers/sitemapController';
import { asyncHandler } from '../middleware/validation';

const router = Router();

router.get('/sitemap.xml', asyncHandler(getSitemap));
router.get('/feed.xml', asyncHandler(getRssFeed));

export default router;
