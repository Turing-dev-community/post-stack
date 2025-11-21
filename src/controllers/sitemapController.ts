import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

const escapeXml = (unsafe: string): string => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

const generateUrlEntry = (url: SitemapUrl): string => {
  let entry = `  <url>\n    <loc>${escapeXml(url.loc)}</loc>\n`;
  
  if (url.lastmod) {
    entry += `    <lastmod>${url.lastmod}</lastmod>\n`;
  }
  
  if (url.changefreq) {
    entry += `    <changefreq>${url.changefreq}</changefreq>\n`;
  }
  
  if (url.priority !== undefined) {
    entry += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
  }
  
  entry += '  </url>\n';
  return entry;
};

export const getSitemap = async (req: Request, res: Response) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const urls: SitemapUrl[] = [];

    urls.push({
      loc: baseUrl,
      changefreq: 'daily',
      priority: 1.0,
    });

    urls.push(
      {
        loc: `${baseUrl}/posts`,
        changefreq: 'daily',
        priority: 0.9,
      },
      {
        loc: `${baseUrl}/categories`,
        changefreq: 'weekly',
        priority: 0.8,
      },
      {
        loc: `${baseUrl}/tags`,
        changefreq: 'weekly',
        priority: 0.8,
      }
    );

    const posts = await prisma.post.findMany({
      where: {
        published: true,
      },
      select: {
        slug: true,
        updatedAt: true,
        featured: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    posts.forEach((post: { slug: string; updatedAt: Date; featured: boolean }) => {
      urls.push({
        loc: `${baseUrl}/posts/${post.slug}`,
        lastmod: post.updatedAt.toISOString(),
        changefreq: 'weekly',
        priority: post.featured ? 0.9 : 0.7,
      });
    });

    const categories = await prisma.category.findMany({
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    categories.forEach((category: { slug: string; updatedAt: Date }) => {
      urls.push({
        loc: `${baseUrl}/categories/${category.slug}`,
        lastmod: category.updatedAt.toISOString(),
        changefreq: 'weekly',
        priority: 0.6,
      });
    });

    const tags = await prisma.tag.findMany({
      select: {
        name: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    tags.forEach((tag: { name: string; updatedAt: Date }) => {
      const encodedTag = encodeURIComponent(tag.name);
      urls.push({
        loc: `${baseUrl}/tags/${encodedTag}`,
        lastmod: tag.updatedAt.toISOString(),
        changefreq: 'weekly',
        priority: 0.5,
      });
    });

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        posts: {
          some: {
            published: true,
          },
        },
      },
      select: {
        username: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    users.forEach((user: { username: string; updatedAt: Date }) => {
      urls.push({
        loc: `${baseUrl}/users/${user.username}`,
        lastmod: user.updatedAt.toISOString(),
        changefreq: 'weekly',
        priority: 0.5,
      });
    });

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    urls.forEach((url) => {
      xml += generateUrlEntry(url);
    });
    
    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({ error: 'Failed to generate sitemap' });
  }
};
