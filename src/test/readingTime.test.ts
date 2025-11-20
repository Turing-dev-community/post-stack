import request from 'supertest';
import { estimateReadingTime } from '../utils/readingTime';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Reading Time', () => {
  it('estimateReadingTime should handle empty content', () => {
    const rt = estimateReadingTime('');
    expect(rt.words).toBe(0);
    expect(rt.minutes).toBe(0);
    expect(rt.text).toBe('0 min read');
  });

  it('estimateReadingTime should compute minutes from words', () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    const rt = estimateReadingTime(words);
    expect(rt.words).toBeGreaterThanOrEqual(400);
    expect(rt.minutes).toBeGreaterThanOrEqual(2);
    expect(rt.text).toMatch(/min read$/);
  });

  describe('API responses include readingTime with minutes ≥ 1 and proper word counting', () => {
    const userId = 'user-rt';
    const authToken = (() => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
      return generateToken(userId);
    })();

    beforeEach(() => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'rt@example.com',
        username: 'readingtime',
        deletedAt: null,
      });
    });

    const markupContent = [
      '# Heading',
      '',
      'This is **bold** text.',
      '',
      '```js',
      'const x = 1;',
      '```',
      '',
      "<script>alert('x')</script>",
    ].join('\n');

    const expectedMarkupWords = 6;

    it('GET /api/posts includes readingTime for each post', async () => {
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'p1',
          title: 'Post One',
          content: 'short',
          slug: 'post-one',
          published: true,
          featured: false,
          authorId: userId,
          categoryId: 'cat1',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: userId, username: 'readingtime' },
          category: { id: 'cat1', name: 'Cat', slug: 'cat' },
          tags: [],
        },
        {
          id: 'p2',
          title: 'Markup Post',
          content: markupContent,
          slug: 'markup-post',
          published: true,
          featured: true,
          authorId: userId,
          categoryId: 'cat1',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: userId, username: 'readingtime' },
          category: { id: 'cat1', name: 'Cat', slug: 'cat' },
          tags: [],
        },
      ]);

      (prismaMock.postLike.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(2);

      const res = await request(app).get('/api/posts').expect(200);
      expect(res.body).toHaveProperty('posts');
      expect(res.body.posts.length).toBe(2);
      res.body.posts.forEach((p: any) => {
        expect(p).toHaveProperty('readingTime');
        expect(p.readingTime.minutes).toBeGreaterThanOrEqual(1);
        expect(p.readingTime.text).toMatch(/min read$/);
      });
      const markupPost = res.body.posts.find((p: any) => p.id === 'p2');
      expect(markupPost.readingTime.words).toBe(expectedMarkupWords);
    });

    it('GET /api/posts/trending includes readingTime', async () => {
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'tp1',
            title: 'Trending',
            content: 'words here',
            slug: 'trending',
            published: true,
            featured: false,
            authorId: userId,
            categoryId: 'cat1',
            viewCount: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
            author: { id: userId, username: 'readingtime' },
            category: { id: 'cat1', name: 'Cat', slug: 'cat' },
            tags: [],
        },
      ]);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);
      const res = await request(app).get('/api/posts/trending').expect(200);
      expect(res.body.posts[0].readingTime.minutes).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/posts/my-posts includes readingTime for user posts', async () => {
      (prismaMock.post.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'mp1',
          title: 'Mine',
          content: 'my post content',
          slug: 'mine',
          published: false,
          featured: false,
          authorId: userId,
          categoryId: 'cat1',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: userId, username: 'readingtime' },
          category: { id: 'cat1', name: 'Cat', slug: 'cat' },
          tags: [],
        },
      ]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.post.count as jest.Mock).mockResolvedValue(1);
      const res = await request(app)
        .get('/api/posts/my-posts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(res.body.posts[0].readingTime.minutes).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/posts/saved includes readingTime for saved posts', async () => {
      (prismaMock.savedPost.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sp1',
          userId,
          postId: 'pSaved',
          createdAt: new Date(),
          post: {
            id: 'pSaved',
            title: 'Saved Title',
            content: 'saved content body',
            slug: 'saved-title',
            published: true,
            featured: false,
            authorId: userId,
            categoryId: 'cat1',
            createdAt: new Date(),
            updatedAt: new Date(),
            author: { id: userId, username: 'readingtime' },
            category: { id: 'cat1', name: 'Cat', slug: 'cat' },
            tags: [],
          },
        },
      ]);
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      (prismaMock.savedPost.count as jest.Mock).mockResolvedValue(1);
      const res = await request(app)
        .get('/api/posts/saved')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(res.body.posts[0].readingTime.minutes).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/posts/:slug includes readingTime', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: 'slug1',
        title: 'Slug Post',
        content: 'content body here',
        slug: 'slug-post',
        published: true,
        featured: false,
        authorId: userId,
        categoryId: 'cat1',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: userId, username: 'readingtime' },
        category: { id: 'cat1', name: 'Cat', slug: 'cat' },
        tags: [],
      });
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(2);
      const res = await request(app).get('/api/posts/slug-post').expect(200);
      expect(res.body.post.readingTime.minutes).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/posts/drafts/:slug includes readingTime for draft', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft1',
        title: 'Draft Post',
        content: 'draft body minimal',
        slug: 'draft-post',
        published: false,
        featured: false,
        authorId: userId,
        categoryId: 'cat1',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: userId, username: 'readingtime' },
        category: { id: 'cat1', name: 'Cat', slug: 'cat' },
        tags: [],
      });
      (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
      const res = await request(app)
        .get('/api/posts/drafts/draft-post')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(res.body.post.readingTime.minutes).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/posts includes readingTime with correct word count for markup content', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.post.create as jest.Mock).mockResolvedValue({
        id: 'create1',
        title: 'Markup Title',
        content: markupContent,
        slug: 'markup-title',
        published: false,
        featured: false,
        authorId: userId,
        categoryId: 'cat1',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: userId, username: 'readingtime' },
        category: { id: 'cat1', name: 'Cat', slug: 'cat' },
        tags: [],
      });
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Markup Title', content: markupContent, categoryId: 'cat1' })
        .expect(201);
      expect(res.body.post.readingTime.words).toBe(expectedMarkupWords);
      expect(res.body.post.readingTime.minutes).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/posts/:id updates readingTime when content changes', async () => {
      (prismaMock.post.findUnique as jest.Mock).mockResolvedValue({
        id: 'upd1',
        title: 'Original',
        content: 'old content',
        slug: 'original',
        published: false,
        featured: false,
        authorId: userId,
        categoryId: 'cat1',
      });
      const newContent = 'one two three four five six seven eight nine ten'; 

      (prismaMock.$transaction as jest.Mock).mockImplementation(async () => ({
        id: 'upd1',
        title: 'Original',
        content: newContent,
        slug: 'original',
        published: false,
        featured: false,
        authorId: userId,
        categoryId: 'cat1',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: userId, username: 'readingtime' },
        category: { id: 'cat1', name: 'Cat', slug: 'cat' },
        tags: [],
      }));
      const res = await request(app)
        .put('/api/posts/upd1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Original', content: newContent })
        .expect(200);
      expect(res.body.post.readingTime.words).toBe(10);
      expect(res.body.post.readingTime.minutes).toBeGreaterThanOrEqual(1);
    });
  });
});

