import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Sitemap Routes', () => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  beforeEach(() => {
    (prismaMock.category.findMany as jest.Mock).mockResolvedValue([
      {
        slug: 'technology',
        updatedAt: new Date('2025-11-20T12:00:00Z'),
      },
      {
        slug: 'tutorial',
        updatedAt: new Date('2025-11-20T12:00:00Z'),
      },
    ]);

    (prismaMock.tag.findMany as jest.Mock).mockResolvedValue([
      {
        name: 'JavaScript',
        updatedAt: new Date('2025-11-20T12:00:00Z'),
      },
      {
        name: 'TypeScript',
        updatedAt: new Date('2025-11-20T12:00:00Z'),
      },
    ]);

    (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.user.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('GET /sitemap.xml', () => {
    it('should return a valid XML sitemap', async () => {
      const res = await request(app).get('/sitemap.xml').expect(200);

      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(res.text).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(res.text).toContain('</urlset>');
    });

    it('should include the homepage in sitemap', async () => {
      const res = await request(app).get('/sitemap.xml').expect(200);

      expect(res.text).toContain(`<loc>${frontendUrl}</loc>`);
      expect(res.text).toContain('<priority>1.0</priority>');
      expect(res.text).toContain('<changefreq>daily</changefreq>');
    });

    it('should include static pages in sitemap', async () => {
      const res = await request(app).get('/sitemap.xml').expect(200);

      expect(res.text).toContain(`<loc>${frontendUrl}/about</loc>`);
      expect(res.text).toContain(`<loc>${frontendUrl}/posts</loc>`);
      expect(res.text).toContain(`<loc>${frontendUrl}/categories</loc>`);
      expect(res.text).toContain(`<loc>${frontendUrl}/tags</loc>`);
    });

    it('should include published posts in sitemap', async () => {
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([
        {
          slug: 'test-post',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
          featured: false,
        },
      ]);

      const res = await request(app).get('/sitemap.xml').expect(200);

      expect(res.text).toContain(`<loc>${frontendUrl}/posts/test-post</loc>`);
      expect(res.text).toContain('<lastmod>2025-11-21T10:00:00.000Z</lastmod>');
      expect(res.text).toContain('<changefreq>weekly</changefreq>');
    });

    it('should mark featured posts with higher priority', async () => {
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([
        {
          slug: 'featured-post',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
          featured: true,
        },
        {
          slug: 'normal-post',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
          featured: false,
        },
      ]);

      const res = await request(app).get('/sitemap.xml').expect(200);

      const featuredMatch = res.text.match(/featured-post.*?<priority>([0-9.]+)<\/priority>/s);
      const normalMatch = res.text.match(/normal-post.*?<priority>([0-9.]+)<\/priority>/s);

      expect(featuredMatch).toBeTruthy();
      expect(normalMatch).toBeTruthy();
      expect(parseFloat(featuredMatch![1])).toBe(0.9);
      expect(parseFloat(normalMatch![1])).toBe(0.7);
    });

    it('should include categories in sitemap', async () => {
      (prismaMock.category.findMany as jest.Mock).mockResolvedValue([
        {
          slug: 'test-category',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
        },
      ]);

      const res = await request(app).get('/sitemap.xml').expect(200);

      expect(res.text).toContain(`<loc>${frontendUrl}/categories/test-category</loc>`);
      expect(res.text).toContain('<lastmod>2025-11-21T10:00:00.000Z</lastmod>');
    });

    it('should include tags in sitemap', async () => {
      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue([
        {
          name: 'TestJavaScript',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
        },
      ]);

      const res = await request(app).get('/sitemap.xml').expect(200);

      expect(res.text).toContain(`<loc>${frontendUrl}/tags/TestJavaScript</loc>`);
      expect(res.text).toContain('<lastmod>2025-11-21T10:00:00.000Z</lastmod>');
    });

    it('should URL encode tag names with special characters', async () => {
      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue([
        {
          name: 'C++',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
        },
      ]);

      const res = await request(app).get('/sitemap.xml').expect(200);

      expect(res.text).toContain(`<loc>${frontendUrl}/tags/C%2B%2B</loc>`);
    });

    it('should include active user profiles with published posts', async () => {
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([
        {
          slug: 'user-post',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
          featured: false,
        },
      ]);

      (prismaMock.user.findMany as jest.Mock).mockResolvedValue([
        {
          username: 'testuser',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
        },
      ]);

      const res = await request(app).get('/sitemap.xml').expect(200);

      expect(res.text).toContain(`<loc>${frontendUrl}/users/testuser</loc>`);
    });

    it('should NOT include users without published posts', async () => {
      (prismaMock.user.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app).get('/sitemap.xml').expect(200);

      expect(res.text).not.toContain(`<loc>${frontendUrl}/users/inactiveuser</loc>`);
    });

    it('should set proper cache headers', async () => {
      const res = await request(app).get('/sitemap.xml').expect(200);

      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age');
    });

    it('should handle multiple posts, categories, and tags', async () => {
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([
        {
          slug: 'post-1',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
          featured: false,
        },
        {
          slug: 'post-2',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
          featured: false,
        },
        {
          slug: 'post-3',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
          featured: false,
        },
      ]);

      (prismaMock.category.findMany as jest.Mock).mockResolvedValue([
        {
          slug: 'tech',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
        },
        {
          slug: 'science',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
        },
      ]);

      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue([
        {
          name: 'TestJS',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
        },
        {
          name: 'TestTS',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
        },
        {
          name: 'TestNode',
          updatedAt: new Date('2025-11-21T10:00:00Z'),
        },
      ]);

      const res = await request(app).get('/sitemap.xml').expect(200);

      // Check all posts are included
      expect(res.text).toContain('post-1');
      expect(res.text).toContain('post-2');
      expect(res.text).toContain('post-3');

      expect(res.text).toContain('tech');
      expect(res.text).toContain('science');

      expect(res.text).toContain('TestJS');
      expect(res.text).toContain('TestTS');
      expect(res.text).toContain('TestNode');
    });

    it('should handle empty database gracefully', async () => {
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.category.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.tag.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.user.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app).get('/sitemap.xml').expect(200);


      expect(res.text).toContain(`<loc>${frontendUrl}</loc>`);
    });

    it('should handle database errors gracefully', async () => {
      (prismaMock.post.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const res = await request(app).get('/sitemap.xml').expect(500);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Failed to generate sitemap');
    });
  });
});
