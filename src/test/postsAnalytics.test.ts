import request from 'supertest';
import { setupPrismaMock } from './utils/mockPrisma';
import { prisma } from '../lib/prisma';
import app from '../index';
import { generateToken } from '../utils/auth';

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe('Post Analytics API', () => {
	const mockAdmin = {
		id: 'admin-1',
		email: 'admin@example.com',
		username: 'admin',
		deletedAt: null,
	};

	const mockAuthor = {
		id: 'author-1',
		email: 'author@example.com',
		username: 'author',
		deletedAt: null,
	};

	let adminToken: string;
	let authorToken: string;

	beforeEach(() => {
		process.env.ADMIN_EMAILS = 'admin@example.com';
		adminToken = generateToken(mockAdmin.id);
		authorToken = generateToken(mockAuthor.id);
	});

	afterEach(() => {
		delete process.env.ADMIN_EMAILS;
		jest.clearAllMocks();
	});

	describe('GET /api/analytics/posts/aggregate', () => {
		it('should require authentication', async () => {
			const response = await request(app)
				.get('/api/analytics/posts/aggregate')
				.expect(401);

			expect(response.body).toHaveProperty('error', 'Access token required');
		});

		it('should require ADMIN role', async () => {
			(prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
				if (args?.where?.id === mockAuthor.id) {
					return Promise.resolve(mockAuthor);
				}
				return Promise.resolve(null);
			});

			const response = await request(app)
				.get('/api/analytics/posts/aggregate')
				.set('Authorization', `Bearer ${authorToken}`)
				.expect(403);

			expect(response.body).toHaveProperty('error', 'ForbiddenError');
			expect(response.body.message).toContain('Access denied');
			expect(response.body.message).toContain('ADMIN');
		});

		it('should return aggregate analytics for admin user', async () => {
			(prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
				if (args?.where?.id === mockAdmin.id) {
					return Promise.resolve(mockAdmin);
				}
				return Promise.resolve(null);
			});

			// Mock database responses
			(prismaMock.post.count as jest.Mock)
				.mockResolvedValueOnce(15) // totalPosts
				.mockResolvedValueOnce(10); // totalPublishedPosts

			(prismaMock.post.aggregate as jest.Mock).mockResolvedValue({
				_sum: {
					viewCount: 1000,
				},
			});

			// Mock top posts
			const mockTopPosts = [
				{ id: 'post-1', title: 'Post 1', slug: 'post-1', viewCount: 200 },
				{ id: 'post-2', title: 'Post 2', slug: 'post-2', viewCount: 150 },
				{ id: 'post-3', title: 'Post 3', slug: 'post-3', viewCount: 100 },
			];

			(prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockTopPosts);

			// Mock counts - order matters: total counts first, then per-post counts
			(prismaMock.postLike.count as jest.Mock)
				.mockResolvedValueOnce(50) // total likes
				.mockResolvedValueOnce(10) // post-1 likes
				.mockResolvedValueOnce(8) // post-2 likes
				.mockResolvedValueOnce(5); // post-3 likes

			(prismaMock.comment.count as jest.Mock)
				.mockResolvedValueOnce(30) // total comments
				.mockResolvedValueOnce(5) // post-1 comments
				.mockResolvedValueOnce(4) // post-2 comments
				.mockResolvedValueOnce(3); // post-3 comments

			(prismaMock.savedPost.count as jest.Mock)
				.mockResolvedValueOnce(20) // total saves
				.mockResolvedValueOnce(3) // post-1 saves
				.mockResolvedValueOnce(2) // post-2 saves
				.mockResolvedValueOnce(1); // post-3 saves

			const response = await request(app)
				.get('/api/analytics/posts/aggregate')
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body).toHaveProperty('analytics');
			expect(response.body.analytics).toHaveProperty('totalPosts', 15);
			expect(response.body.analytics).toHaveProperty('totalPublishedPosts', 10);
			expect(response.body.analytics).toHaveProperty('totalViews', 1000);
			expect(response.body.analytics).toHaveProperty('totalLikes', 50);
			expect(response.body.analytics).toHaveProperty('totalComments', 30);
			expect(response.body.analytics).toHaveProperty('totalSaves', 20);
			expect(response.body.analytics).toHaveProperty('averageViewsPerPost');
			expect(response.body.analytics).toHaveProperty('averageLikesPerPost');
			expect(response.body.analytics).toHaveProperty('averageCommentsPerPost');
			expect(response.body.analytics).toHaveProperty('topPosts');
			expect(Array.isArray(response.body.analytics.topPosts)).toBe(true);
		});

		it('should calculate averages correctly', async () => {
			(prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
				if (args?.where?.id === mockAdmin.id) {
					return Promise.resolve(mockAdmin);
				}
				return Promise.resolve(null);
			});

			(prismaMock.post.count as jest.Mock)
				.mockResolvedValueOnce(10) // totalPosts
				.mockResolvedValueOnce(5); // totalPublishedPosts

			(prismaMock.postLike.count as jest.Mock).mockResolvedValue(25);
			(prismaMock.comment.count as jest.Mock).mockResolvedValue(15);
			(prismaMock.savedPost.count as jest.Mock).mockResolvedValue(10);

			(prismaMock.post.aggregate as jest.Mock).mockResolvedValue({
				_sum: {
					viewCount: 500,
				},
			});

			(prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);

			const response = await request(app)
				.get('/api/analytics/posts/aggregate')
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			// averageViewsPerPost = 500 / 5 = 100
			expect(response.body.analytics.averageViewsPerPost).toBe(100);
			// averageLikesPerPost = 25 / 5 = 5
			expect(response.body.analytics.averageLikesPerPost).toBe(5);
			// averageCommentsPerPost = 15 / 5 = 3
			expect(response.body.analytics.averageCommentsPerPost).toBe(3);
		});

		it('should round averages to 2 decimal places', async () => {
			(prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
				if (args?.where?.id === mockAdmin.id) {
					return Promise.resolve(mockAdmin);
				}
				return Promise.resolve(null);
			});

			(prismaMock.post.count as jest.Mock)
				.mockResolvedValueOnce(10) // totalPosts
				.mockResolvedValueOnce(3); // totalPublishedPosts

			(prismaMock.postLike.count as jest.Mock).mockResolvedValue(10);
			(prismaMock.comment.count as jest.Mock).mockResolvedValue(7);
			(prismaMock.savedPost.count as jest.Mock).mockResolvedValue(5);

			(prismaMock.post.aggregate as jest.Mock).mockResolvedValue({
				_sum: {
					viewCount: 10,
				},
			});

			(prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);

			const response = await request(app)
				.get('/api/analytics/posts/aggregate')
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			// averageViewsPerPost = 10 / 3 = 3.333... should round to 3.33
			expect(response.body.analytics.averageViewsPerPost).toBe(3.33);
			// averageLikesPerPost = 10 / 3 = 3.333... should round to 3.33
			expect(response.body.analytics.averageLikesPerPost).toBe(3.33);
			// averageCommentsPerPost = 7 / 3 = 2.333... should round to 2.33
			expect(response.body.analytics.averageCommentsPerPost).toBe(2.33);
		});

		it('should return averages as 0 when no published posts exist', async () => {
			(prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
				if (args?.where?.id === mockAdmin.id) {
					return Promise.resolve(mockAdmin);
				}
				return Promise.resolve(null);
			});

			(prismaMock.post.count as jest.Mock)
				.mockResolvedValueOnce(5) // totalPosts
				.mockResolvedValueOnce(0); // totalPublishedPosts

			(prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);
			(prismaMock.comment.count as jest.Mock).mockResolvedValue(0);
			(prismaMock.savedPost.count as jest.Mock).mockResolvedValue(0);

			(prismaMock.post.aggregate as jest.Mock).mockResolvedValue({
				_sum: {
					viewCount: null,
				},
			});

			(prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);

			const response = await request(app)
				.get('/api/analytics/posts/aggregate')
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.analytics.averageViewsPerPost).toBe(0);
			expect(response.body.analytics.averageLikesPerPost).toBe(0);
			expect(response.body.analytics.averageCommentsPerPost).toBe(0);
			expect(response.body.analytics.totalViews).toBe(0);
		});

		it('should exclude deleted comments from total comments count', async () => {
			(prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
				if (args?.where?.id === mockAdmin.id) {
					return Promise.resolve(mockAdmin);
				}
				return Promise.resolve(null);
			});

			(prismaMock.post.count as jest.Mock)
				.mockResolvedValueOnce(10) // totalPosts
				.mockResolvedValueOnce(5); // totalPublishedPosts

			(prismaMock.postLike.count as jest.Mock).mockResolvedValue(10);
			// Mock comment.count to verify it's called with deletedAt: null
			(prismaMock.comment.count as jest.Mock).mockResolvedValue(8);
			(prismaMock.savedPost.count as jest.Mock).mockResolvedValue(5);

			(prismaMock.post.aggregate as jest.Mock).mockResolvedValue({
				_sum: {
					viewCount: 100,
				},
			});

			(prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);

			await request(app)
				.get('/api/analytics/posts/aggregate')
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			// Verify comment.count was called with deletedAt: null
			expect(prismaMock.comment.count).toHaveBeenCalledWith({
				where: { deletedAt: null },
			});
		});

		it('should only include published posts in view totals and top posts', async () => {
			(prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
				if (args?.where?.id === mockAdmin.id) {
					return Promise.resolve(mockAdmin);
				}
				return Promise.resolve(null);
			});

			(prismaMock.post.count as jest.Mock)
				.mockResolvedValueOnce(10) // totalPosts
				.mockResolvedValueOnce(5); // totalPublishedPosts

			(prismaMock.postLike.count as jest.Mock).mockResolvedValue(10);
			(prismaMock.comment.count as jest.Mock).mockResolvedValue(5);
			(prismaMock.savedPost.count as jest.Mock).mockResolvedValue(5);

			(prismaMock.post.aggregate as jest.Mock).mockResolvedValue({
				_sum: {
					viewCount: 100,
				},
			});

			(prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);

			await request(app)
				.get('/api/analytics/posts/aggregate')
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			// Verify aggregate was called with published: true
			expect(prismaMock.post.aggregate).toHaveBeenCalledWith({
				where: { published: true },
				_sum: {
					viewCount: true,
				},
			});

			// Verify findMany was called with published: true
			expect(prismaMock.post.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { published: true },
					orderBy: { viewCount: 'desc' },
					take: 10,
				})
			);
		});

		it('should return top 10 posts ordered by view count descending', async () => {
			(prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
				if (args?.where?.id === mockAdmin.id) {
					return Promise.resolve(mockAdmin);
				}
				return Promise.resolve(null);
			});

			(prismaMock.post.count as jest.Mock)
				.mockResolvedValueOnce(10) // totalPosts
				.mockResolvedValueOnce(5); // totalPublishedPosts

			(prismaMock.post.aggregate as jest.Mock).mockResolvedValue({
				_sum: {
					viewCount: 100,
				},
			});

			const mockTopPosts = [
				{ id: 'post-1', title: 'Top Post', slug: 'top-post', viewCount: 500 },
				{ id: 'post-2', title: 'Second Post', slug: 'second-post', viewCount: 300 },
			];

			(prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockTopPosts);

			// Mock counts - order matters: total counts first, then per-post counts
			(prismaMock.postLike.count as jest.Mock)
				.mockResolvedValueOnce(10) // total likes
				.mockResolvedValueOnce(20) // post-1
				.mockResolvedValueOnce(15); // post-2

			(prismaMock.comment.count as jest.Mock)
				.mockResolvedValueOnce(5) // total comments
				.mockResolvedValueOnce(10) // post-1
				.mockResolvedValueOnce(8); // post-2

			(prismaMock.savedPost.count as jest.Mock)
				.mockResolvedValueOnce(5) // total saves
				.mockResolvedValueOnce(5) // post-1
				.mockResolvedValueOnce(3); // post-2

			const response = await request(app)
				.get('/api/analytics/posts/aggregate')
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.analytics.topPosts).toHaveLength(2);
			expect(response.body.analytics.topPosts[0]).toHaveProperty('postId', 'post-1');
			expect(response.body.analytics.topPosts[0]).toHaveProperty('title', 'Top Post');
			expect(response.body.analytics.topPosts[0]).toHaveProperty('slug', 'top-post');
			expect(response.body.analytics.topPosts[0]).toHaveProperty('views', 500);
			expect(response.body.analytics.topPosts[0]).toHaveProperty('likes', 20);
			expect(response.body.analytics.topPosts[0]).toHaveProperty('comments', 10);
			expect(response.body.analytics.topPosts[0]).toHaveProperty('saves', 5);
		});

		it('should exclude deleted comments from top post comment counts', async () => {
			(prismaMock.user.findUnique as jest.Mock).mockImplementation((args: any) => {
				if (args?.where?.id === mockAdmin.id) {
					return Promise.resolve(mockAdmin);
				}
				return Promise.resolve(null);
			});

			(prismaMock.post.count as jest.Mock)
				.mockResolvedValueOnce(10) // totalPosts
				.mockResolvedValueOnce(5); // totalPublishedPosts

			(prismaMock.postLike.count as jest.Mock).mockResolvedValue(10);
			(prismaMock.comment.count as jest.Mock)
				.mockResolvedValueOnce(5) // total comments
				.mockResolvedValueOnce(3); // post-1 comments (non-deleted)

			(prismaMock.savedPost.count as jest.Mock).mockResolvedValue(5);

			(prismaMock.post.aggregate as jest.Mock).mockResolvedValue({
				_sum: {
					viewCount: 100,
				},
			});

			const mockTopPosts = [
				{ id: 'post-1', title: 'Top Post', slug: 'top-post', viewCount: 500 },
			];

			(prismaMock.post.findMany as jest.Mock).mockResolvedValue(mockTopPosts);

			(prismaMock.postLike.count as jest.Mock).mockResolvedValueOnce(20);
			(prismaMock.savedPost.count as jest.Mock).mockResolvedValueOnce(5);

			const response = await request(app)
				.get('/api/analytics/posts/aggregate')
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			// Verify comment.count for top post was called with deletedAt: null
			expect(prismaMock.comment.count).toHaveBeenCalledWith({
				where: {
					postId: 'post-1',
					deletedAt: null,
				},
			});

			expect(response.body.analytics.topPosts[0].comments).toBe(3);
		});

	});
});

