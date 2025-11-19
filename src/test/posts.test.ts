import { prisma } from "./setup";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

describe("Blog Post Routes", () => {
	const baseUrl = `http://localhost:${process.env.PORT}/api`;
	let authToken: string;
	let userId: string;

	beforeEach(async () => {
		const hashedPassword = await bcrypt.hash("Password123", 12);
		const user = await prisma.user.create({
			data: {
				email: "test@example.com",
				username: "testuser",
				password: hashedPassword,
			},
		});
		userId = user.id;
		authToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);
	});

	describe("GET /api/posts", () => {
		it("should return published posts", async () => {
			// Create test posts
			await prisma.post.createMany({
				data: [
					{
						title: "Test Post 1",
						content: "# Test Content",
						slug: "test-post-1",
						published: true,
						authorId: userId,
					},
					{
						title: "Test Post 2",
						content: "# Test Content 2",
						slug: "test-post-2",
						published: true,
						authorId: userId,
					},
					{
						title: "Draft Post",
						content: "# Draft Content",
						slug: "draft-post",
						published: false,
						authorId: userId,
					},
				],
			});

			const response = await fetch(`${baseUrl}/posts`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("posts");
			expect(data).toHaveProperty("pagination");
			expect(data.posts).toHaveLength(2);
			expect(data.posts[0].published).toBe(true);
			expect(data.posts[1].published).toBe(true);
		});

		it("should return tags when fetching posts list", async () => {
			const tags = await prisma.tag.findMany({ take: 2 });
			const tagIds = tags.map((tag) => tag.id);

			// Create a post with a unique title to ensure it's found
			const uniqueTitle = `Tagged Post ${Date.now()}`;
			const uniqueSlug = `tagged-post-${Date.now()}`;

			const post = await prisma.post.create({
				data: {
					title: uniqueTitle,
					content: "# Content",
					slug: uniqueSlug,
					published: true,
					authorId: userId,
					tags: {
						create: tagIds.map((tagId) => ({ tagId })),
					},
				},
			});

			// Fetch posts, optionally filter by author to ensure we find our post
			const response = await fetch(`${baseUrl}/posts?authorId=${userId}`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("posts");
			expect(Array.isArray(data.posts)).toBe(true);

			// Find the post we just created
			const taggedPost = data.posts.find(
				(p: any) => p.id === post.id || p.slug === uniqueSlug
			);
			expect(taggedPost).toBeDefined();
			expect(taggedPost.tags).toBeDefined();
			expect(Array.isArray(taggedPost.tags)).toBe(true);
			expect(taggedPost.tags.length).toBe(2);
			expect(taggedPost.tags[0]).toHaveProperty("id");
			expect(taggedPost.tags[0]).toHaveProperty("name");
		});

		it("should support pagination", async () => {
			// Create multiple posts
			const posts = Array.from({ length: 15 }, (_, i) => ({
				title: `Post ${i + 1}`,
				content: `# Content ${i + 1}`,
				slug: `post-${i + 1}`,
				published: true,
				authorId: userId,
			}));

			await prisma.post.createMany({ data: posts });

			const response = await fetch(`${baseUrl}/posts?page=2&limit=5`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.pagination.page).toBe(2);
			expect(data.pagination.limit).toBe(5);
			expect(data.posts).toHaveLength(5);
		});

		it("should search posts by title", async () => {
			// Create test posts with various titles
			await prisma.post.createMany({
				data: [
					{
						title: "JavaScript Tutorial",
						content: "# JavaScript Content",
						slug: "javascript-tutorial",
						published: true,
						authorId: userId,
					},
					{
						title: "Advanced JavaScript Concepts",
						content: "# Advanced Content",
						slug: "advanced-javascript",
						published: true,
						authorId: userId,
					},
					{
						title: "Python for Beginners",
						content: "# Python Content",
						slug: "python-beginners",
						published: true,
						authorId: userId,
					},
					{
						title: "JavaScript vs Python",
						content: "# Comparison Content",
						slug: "javascript-vs-python",
						published: true,
						authorId: userId,
					},
					{
						title: "React Development Guide",
						content: "# React Content",
						slug: "react-guide",
						published: true,
						authorId: userId,
					},
				],
			});

			const response = await fetch(`${baseUrl}/posts?title=JavaScript`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("posts");
			expect(data).toHaveProperty("pagination");
			expect(data.posts).toHaveLength(3); // Should find 3 posts with "JavaScript" in title
			expect(
				data.posts.every((post: any) =>
					post.title.toLowerCase().includes("javascript")
				)
			).toBe(true);
		});

		it("should perform case-insensitive search", async () => {
			await prisma.post.create({
				data: {
					title: "JavaScript Tutorial",
					content: "# JavaScript Content",
					slug: "javascript-tutorial",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts?title=JAVASCRIPT`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toHaveLength(1);
			expect(data.posts[0].title).toBe("JavaScript Tutorial");
		});

		it("should support partial matching", async () => {
			await prisma.post.createMany({
				data: [
					{
						title: "JavaScript Tutorial",
						content: "# JavaScript Content",
						slug: "javascript-tutorial",
						published: true,
						authorId: userId,
					},
					{
						title: "Advanced JavaScript Concepts",
						content: "# Advanced Content",
						slug: "advanced-javascript",
						published: true,
						authorId: userId,
					},
				],
			});

			const response = await fetch(`${baseUrl}/posts?title=Tutorial`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toHaveLength(1);
			expect(data.posts[0].title).toBe("JavaScript Tutorial");
		});

		it("should return empty results for non-matching search", async () => {
			await prisma.post.create({
				data: {
					title: "JavaScript Tutorial",
					content: "# JavaScript Content",
					slug: "javascript-tutorial",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts?title=NonExistent`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toHaveLength(0);
			expect(data.pagination.total).toBe(0);
		});

		it("should maintain backward compatibility when no title parameter is provided", async () => {
			await prisma.post.createMany({
				data: [
					{
						title: "JavaScript Tutorial",
						content: "# JavaScript Content",
						slug: "javascript-tutorial",
						published: true,
						authorId: userId,
					},
					{
						title: "Python Guide",
						content: "# Python Content",
						slug: "python-guide",
						published: true,
						authorId: userId,
					},
				],
			});

			const response = await fetch(`${baseUrl}/posts`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toHaveLength(2); // Should return all posts
			expect(data.pagination.total).toBe(2);
		});

		it("should work with pagination and search together", async () => {
			// Create multiple posts with similar titles
			const posts = Array.from({ length: 15 }, (_, i) => ({
				title: `JavaScript Post ${i + 1}`,
				content: `# JavaScript Content ${i + 1}`,
				slug: `javascript-post-${i + 1}`,
				published: true,
				authorId: userId,
			}));

			await prisma.post.createMany({ data: posts });

			const response = await fetch(
				`${baseUrl}/posts?title=JavaScript&page=2&limit=5`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.pagination.page).toBe(2);
			expect(data.pagination.limit).toBe(5);
			expect(data.posts).toHaveLength(5);
			expect(data.pagination.total).toBe(15);
			expect(
				data.posts.every((post: any) =>
					post.title.toLowerCase().includes("javascript")
				)
			).toBe(true);
		});

		it("should filter posts by author ID", async () => {
			// Create another user
			const otherUser = await prisma.user.create({
				data: {
					email: "author2@example.com",
					username: "author2",
					password: await bcrypt.hash("Password123", 12),
				},
			});

			// Create posts from both users
			await prisma.post.createMany({
				data: [
					{
						title: "Post by User 1",
						content: "# Content 1",
						slug: "post-by-user-1",
						published: true,
						authorId: userId,
					},
					{
						title: "Post by User 2",
						content: "# Content 2",
						slug: "post-by-user-2",
						published: true,
						authorId: otherUser.id,
					},
					{
						title: "Another Post by User 1",
						content: "# Content 3",
						slug: "another-post-by-user-1",
						published: true,
						authorId: userId,
					},
				],
			});

			// Filter by first user
			const response = await fetch(`${baseUrl}/posts?authorId=${userId}`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toHaveLength(2);
			expect(
				data.posts.every((post: any) => post.author.id === userId)
			).toBe(true);
			expect(data.pagination.total).toBe(2);
		});

		it("should filter posts by category ID", async () => {
			const [category1, category2] = await prisma.category.findMany({
				take: 2,
			});

			// Create posts in different categories
			await prisma.post.createMany({
				data: [
					{
						title: "Tech Post 1",
						content: "# Tech Content",
						slug: "tech-post-1",
						published: true,
						authorId: userId,
						categoryId: category1.id,
					},
					{
						title: "Science Post 1",
						content: "# Science Content",
						slug: "science-post-1",
						published: true,
						authorId: userId,
						categoryId: category2.id,
					},
					{
						title: "Tech Post 2",
						content: "# Tech Content 2",
						slug: "tech-post-2",
						published: true,
						authorId: userId,
						categoryId: category1.id,
					},
					{
						title: "Uncategorized Post",
						content: "# No Category",
						slug: "uncategorized-post",
						published: true,
						authorId: userId,
						categoryId: null,
					},
				],
			});

			// Filter by category
			const response = await fetch(
				`${baseUrl}/posts?categoryId=${category1.id}`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toHaveLength(2);
			expect(
				data.posts.every(
					(post: any) => post.category.id === category1.id
				)
			).toBe(true);
			expect(data.pagination.total).toBe(2);
		});

		it("should filter posts by author and category together", async () => {
			const otherUser = await prisma.user.create({
				data: {
					email: "author3@example.com",
					username: "author3",
					password: await bcrypt.hash("Password123", 12),
				},
			});

			const category = await prisma.category.findFirstOrThrow({
				where: {
					name: "Tutorial",
				},
			});

			// Create posts with different authors and categories
			await prisma.post.createMany({
				data: [
					{
						title: "Post 1",
						content: "# Content 1",
						slug: "post-1-filtered",
						published: true,
						authorId: userId,
						categoryId: category.id,
					},
					{
						title: "Post 2",
						content: "# Content 2",
						slug: "post-2-filtered",
						published: true,
						authorId: userId,
						categoryId: null,
					},
					{
						title: "Post 3",
						content: "# Content 3",
						slug: "post-3-filtered",
						published: true,
						authorId: otherUser.id,
						categoryId: category.id,
					},
				],
			});

			const response = await fetch(
				`${baseUrl}/posts?authorId=${userId}&categoryId=${category.id}`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toHaveLength(1);
			expect(data.posts[0].author.id).toBe(userId);
			expect(data.posts[0].category.id).toBe(category.id);
		});

		it("should sort posts by createdAt ascending", async () => {
			// Create posts with different creation times
			await prisma.post.create({
				data: {
					title: "First Post",
					content: "# First Content",
					slug: "first-post-sort",
					published: true,
					authorId: userId,
				},
			});

			// Wait a bit to ensure different timestamps
			await new Promise((resolve) => setTimeout(resolve, 100));

			await prisma.post.create({
				data: {
					title: "Second Post",
					content: "# Second Content",
					slug: "second-post-sort",
					published: true,
					authorId: userId,
				},
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			await prisma.post.create({
				data: {
					title: "Third Post",
					content: "# Third Content",
					slug: "third-post-sort",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(
				`${baseUrl}/posts?sortBy=createdAt&sortOrder=asc`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toHaveLength(3);
			// Check that posts are in ascending order
			const timestamps = data.posts.map((post: any) =>
				new Date(post.createdAt).getTime()
			);
			expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
		});

		it("should sort posts by updatedAt descending", async () => {
			const post1 = await prisma.post.create({
				data: {
					title: "First Post",
					content: "# First Content",
					slug: "first-post-updated",
					published: true,
					authorId: userId,
				},
			});

			const post2 = await prisma.post.create({
				data: {
					title: "Second Post",
					content: "# Second Content",
					slug: "second-post-updated",
					published: true,
					authorId: userId,
				},
			});

			// Update post1 to make it have a newer updatedAt
			await new Promise((resolve) => setTimeout(resolve, 100));
			await prisma.post.update({
				where: { id: post1.id },
				data: { content: "# Updated Content" },
			});

			const response = await fetch(
				`${baseUrl}/posts?sortBy=updatedAt&sortOrder=desc`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts.length).toBeGreaterThan(0);
			// Post 1 should come first since it was updated most recently
			expect(data.posts[0].slug).toBe("first-post-updated");
		});

		it("should work with all filters and sorting together", async () => {
			const category = await prisma.category.findFirstOrThrow({
				where: {
					name: "Tutorial",
				},
			});

			await prisma.post.createMany({
				data: [
					{
						title: "JavaScript Tutorial",
						content: "# Content",
						slug: "js-tutorial-1",
						published: true,
						authorId: userId,
						categoryId: category.id,
					},
					{
						title: "Python Tutorial",
						content: "# Content",
						slug: "python-tutorial-1",
						published: true,
						authorId: userId,
						categoryId: category.id,
					},
					{
						title: "React Tutorial",
						content: "# Content",
						slug: "react-tutorial-1",
						published: true,
						authorId: userId,
						categoryId: category.id,
					},
				],
			});

			const response = await fetch(
				`${baseUrl}/posts?title=Tutorial&categoryId=${category.id}&sortBy=title&sortOrder=asc&limit=2`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toHaveLength(2);

			expect(
				data.posts.every(
					(post: any) => post.category.id === category.id
				)
			).toBe(true);
			expect(
				data.posts.every((post: any) =>
					post.title.toLowerCase().includes("tutorial")
				)
			).toBe(true);
		});

		it("should return featured posts before non-featured posts", async () => {
			// Create posts with different featured status
			await prisma.post.createMany({
				data: [
					{
						title: "Regular Post 1",
						content: "# Content",
						slug: "regular-post-1",
						published: true,
						featured: false,
						authorId: userId,
					},
					{
						title: "Featured Post 1",
						content: "# Content",
						slug: "featured-post-1",
						published: true,
						featured: true,
						authorId: userId,
					},
					{
						title: "Regular Post 2",
						content: "# Content",
						slug: "regular-post-2",
						published: true,
						featured: false,
						authorId: userId,
					},
				],
			});

			const postData = {
				title: "Featured Post 2",
				content: "# Content",
				slug: "featured-post-2",
				published: true,
				featured: true,
				authorId: userId,
			};

			const res = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			expect(res.status).toBe(201);

			const response = await fetch(`${baseUrl}/posts`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts.length).toBeGreaterThanOrEqual(4);

			// Find indices of featured posts
			const featuredPost1Index = data.posts.findIndex(
				(p: any) => p.slug === "featured-post-1"
			);
			const featuredPost2Index = data.posts.findIndex(
				(p: any) => p.slug === "featured-post-2"
			);
			const regularPost1Index = data.posts.findIndex(
				(p: any) => p.slug === "regular-post-1"
			);
			const regularPost2Index = data.posts.findIndex(
				(p: any) => p.slug === "regular-post-2"
			);

			// Featured posts should appear before regular posts
			expect(featuredPost1Index).toBeLessThan(regularPost1Index);
			expect(featuredPost1Index).toBeLessThan(regularPost2Index);
			expect(featuredPost2Index).toBeLessThan(regularPost1Index);
			expect(featuredPost2Index).toBeLessThan(regularPost2Index);

			// Verify featured status
			expect(data.posts[featuredPost1Index].featured).toBe(true);
			expect(data.posts[featuredPost2Index].featured).toBe(true);
			expect(data.posts[regularPost1Index].featured).toBe(false);
			expect(data.posts[regularPost2Index].featured).toBe(false);
		});

		it("should sort featured posts first, then apply other sort parameters", async () => {
			// Create posts with different featured status and creation dates
			const now = new Date();
			await prisma.post.createMany({
				data: [
					{
						title: "Old Featured Post",
						content: "# Content",
						slug: "old-featured-post",
						published: true,
						featured: true,
						authorId: userId,
						createdAt: new Date(now.getTime() - 86400000), // 1 day ago
					},
					{
						title: "Recent Regular Post",
						content: "# Content",
						slug: "recent-regular-post",
						published: true,
						featured: false,
						authorId: userId,
						createdAt: new Date(now.getTime() - 3600000), // 1 hour ago
					},
					{
						title: "New Featured Post",
						content: "# Content",
						slug: "new-featured-post",
						published: true,
						featured: true,
						authorId: userId,
						createdAt: now, // Just now
					},
					{
						title: "Older Regular Post",
						content: "# Content",
						slug: "older-regular-post",
						published: true,
						featured: false,
						authorId: userId,
						createdAt: new Date(now.getTime() - 172800000), // 2 days ago
					},
				],
			});

			// Request posts sorted by createdAt descending
			const response = await fetch(
				`${baseUrl}/posts?sortBy=createdAt&sortOrder=desc`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts.length).toBeGreaterThanOrEqual(4);

			// Find indices of posts
			const newFeaturedIndex = data.posts.findIndex(
				(p: any) => p.slug === "new-featured-post"
			);
			const oldFeaturedIndex = data.posts.findIndex(
				(p: any) => p.slug === "old-featured-post"
			);
			const recentRegularIndex = data.posts.findIndex(
				(p: any) => p.slug === "recent-regular-post"
			);
			const olderRegularIndex = data.posts.findIndex(
				(p: any) => p.slug === "older-regular-post"
			);

			// Featured posts should appear first (in descending order by createdAt)
			expect(newFeaturedIndex).toBeLessThan(oldFeaturedIndex);
			expect(newFeaturedIndex).toBeLessThan(recentRegularIndex);
			expect(newFeaturedIndex).toBeLessThan(olderRegularIndex);
			expect(oldFeaturedIndex).toBeLessThan(recentRegularIndex);
			expect(oldFeaturedIndex).toBeLessThan(olderRegularIndex);

			// Regular posts should appear after all featured posts (also sorted by createdAt desc)
			expect(recentRegularIndex).toBeLessThan(olderRegularIndex);
		});
	});

	describe("GET /api/posts/trending", () => {
		it("should return only published posts from the last 30 days", async () => {
			// Create posts within last 30 days
			const recentPost = await prisma.post.create({
				data: {
					title: "Recent Post",
					content: "# Recent Content",
					slug: "recent-post",
					published: true,
					authorId: userId,
					viewCount: 100,
					createdAt: new Date(), // Today
				},
			});

			// Create unpublished post (should not be included)
			await prisma.post.create({
				data: {
					title: "Unpublished Post",
					content: "# Unpublished Content",
					slug: "unpublished-post",
					published: false,
					authorId: userId,
					viewCount: 200,
					createdAt: new Date(),
				},
			});

			const response = await fetch(`${baseUrl}/posts/trending`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("posts");
			expect(data).toHaveProperty("pagination");
			expect(data.posts.length).toBeGreaterThanOrEqual(1);
			expect(data.posts.every((p: any) => p.published === true)).toBe(
				true
			);
			expect(data.posts.some((p: any) => p.slug === "recent-post")).toBe(
				true
			);
			expect(
				data.posts.every((p: any) => p.slug !== "unpublished-post")
			).toBe(true);
		});

		it("should exclude posts older than 30 days", async () => {
			// Create a post from 31 days ago
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 31);

			const oldPost = await prisma.post.create({
				data: {
					title: "Old Post",
					content: "# Old Content",
					slug: "old-post",
					published: true,
					authorId: userId,
					viewCount: 500, // High views but old
					createdAt: oldDate,
				},
			});

			// Create a post from 29 days ago (should be included)
			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 29);

			const recentPost = await prisma.post.create({
				data: {
					title: "Recent Post",
					content: "# Recent Content",
					slug: "recent-post",
					published: true,
					authorId: userId,
					viewCount: 50,
					createdAt: recentDate,
				},
			});

			const response = await fetch(`${baseUrl}/posts/trending`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts.length).toBeGreaterThanOrEqual(1);

			const postSlugs = data.posts.map((p: any) => p.slug);
			expect(postSlugs).toContain("recent-post");
			expect(postSlugs).not.toContain("old-post");
		});

		it("should order posts by viewCount descending (higher views first)", async () => {
			// Calculate dates within last 30 days
			const now = new Date();
			const date10DaysAgo = new Date(
				now.getTime() - 10 * 24 * 60 * 60 * 1000
			);
			const date15DaysAgo = new Date(
				now.getTime() - 15 * 24 * 60 * 60 * 1000
			);
			const date5DaysAgo = new Date(
				now.getTime() - 5 * 24 * 60 * 60 * 1000
			);

			// Create posts with different view counts within last 30 days
			const lowViewsPost = await prisma.post.create({
				data: {
					title: "Low Views Post",
					content: "# Low Views Content",
					slug: "low-views-post",
					published: true,
					authorId: userId,
					viewCount: 10,
					createdAt: date10DaysAgo,
				},
			});

			const highViewsPost = await prisma.post.create({
				data: {
					title: "High Views Post",
					content: "# High Views Content",
					slug: "high-views-post",
					published: true,
					authorId: userId,
					viewCount: 500,
					createdAt: date15DaysAgo,
				},
			});

			// Create mediumViewsPost using POST API
			const mediumViewsPostData = {
				title: "Medium Views Post",
				content: "# Medium Views Content",
				published: true,
			};

			const mediumViewsPostResponse = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(mediumViewsPostData),
			});

			const mediumViewsPostResult: any =
				await mediumViewsPostResponse.json();
			expect(mediumViewsPostResponse.status).toBe(201);
			const mediumViewsPost = mediumViewsPostResult.post;

			// Update viewCount and createdAt using Prisma for test requirements
			await prisma.post.update({
				where: { id: mediumViewsPost.id },
				data: {
					viewCount: 100,
					createdAt: date5DaysAgo,
				},
			});

			// Verify all three posts exist, are published, and have correct dates
			const allPosts = await prisma.post.findMany({
				where: {
					slug: {
						in: [
							"high-views-post",
							"medium-views-post",
							"low-views-post",
						],
					},
				},
			});
			expect(allPosts.length).toBe(3);
			expect(allPosts.every((p) => p.published === true)).toBe(true);

			// Verify dates are within last 30 days
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			expect(allPosts.every((p) => p.createdAt >= thirtyDaysAgo)).toBe(
				true
			);

			// Fetch trending posts with a higher limit to ensure we get all our test posts
			const response = await fetch(`${baseUrl}/posts/trending?limit=50`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("posts");
			expect(Array.isArray(data.posts)).toBe(true);

			// Find the posts we created
			const highViews = data.posts.find(
				(p: any) => p.slug === "high-views-post"
			);
			const mediumViews = data.posts.find(
				(p: any) => p.slug === "medium-views-post"
			);
			const lowViews = data.posts.find(
				(p: any) => p.slug === "low-views-post"
			);

			// All three posts should be in the trending results
			expect(highViews).toBeDefined();
			expect(mediumViews).toBeDefined();
			expect(lowViews).toBeDefined();

			// Check that posts are ordered by viewCount descending
			const highViewsIndex = data.posts.findIndex(
				(p: any) => p.slug === "high-views-post"
			);
			const mediumViewsIndex = data.posts.findIndex(
				(p: any) => p.slug === "medium-views-post"
			);
			const lowViewsIndex = data.posts.findIndex(
				(p: any) => p.slug === "low-views-post"
			);

			// High views should come before medium views
			expect(highViewsIndex).toBeLessThan(mediumViewsIndex);
			// Medium views should come before low views
			expect(mediumViewsIndex).toBeLessThan(lowViewsIndex);
			// Verify viewCount values
			expect(highViews.viewCount).toBe(500);
			expect(mediumViews.viewCount).toBe(100);
			expect(lowViews.viewCount).toBe(10);
		});
	});

	describe("GET /api/posts/:slug", () => {
		it("should return published post by slug", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Test Post",
					content: "# Test Content",
					slug: "test-post",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/test-post`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("post");
			expect(data.post.slug).toBe("test-post");
			expect(data.post.published).toBe(true);
		});

		it("should return post with SEO metadata", async () => {
			const post = await prisma.post.create({
				data: {
					title: "SEO Test Post",
					content: "# SEO Test Content",
					slug: "seo-test-post",
					published: true,
					authorId: userId,
					metaTitle: "Custom SEO Title",
					metaDescription: "Custom meta description for SEO",
					ogImage: "https://example.com/seo-image.jpg",
				},
			});

			const response = await fetch(`${baseUrl}/posts/seo-test-post`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("post");
			expect(data.post.metaTitle).toBe("Custom SEO Title");
			expect(data.post.metaDescription).toBe(
				"Custom meta description for SEO"
			);
			expect(data.post.ogImage).toBe("https://example.com/seo-image.jpg");
		});

		it("should return 404 for non-existent post", async () => {
			const response = await fetch(`${baseUrl}/posts/non-existent`);

			const data: any = await response.json();

			expect(response.status).toBe(404);
			expect(data).toHaveProperty("error", "Post not found");
		});

		it("should return 404 for unpublished post when not authenticated", async () => {
			await prisma.post.create({
				data: {
					title: "Draft Post",
					content: "# Draft Content",
					slug: "draft-post",
					published: false,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/draft-post`);

			const data: any = await response.json();

			expect(response.status).toBe(404);
			expect(data).toHaveProperty("error", "Post not found");
		});

		it("should return unpublished post when user is the author", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Draft Post",
					content: "# Draft Content",
					slug: "draft-post",
					published: false,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/drafts/draft-post`, {
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("post");
			expect(data.post.slug).toBe("draft-post");
			expect(data.post.published).toBe(false);
		});

		it("should return tags when fetching post", async () => {
			const tags = await prisma.tag.findMany({ take: 2 });
			const tagIds = tags.map((tag) => tag.id);

			const post = await prisma.post.create({
				data: {
					title: "Post with Tags",
					content: "# Content",
					slug: "post-with-tags",
					published: true,
					authorId: userId,
					tags: {
						create: tagIds.map((tagId) => ({ tagId })),
					},
				},
			});

			const response = await fetch(`${baseUrl}/posts/post-with-tags`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.post.tags).toBeDefined();
			expect(Array.isArray(data.post.tags)).toBe(true);
			expect(data.post.tags.length).toBe(2);
			expect(data.post.tags[0]).toHaveProperty("id");
			expect(data.post.tags[0]).toHaveProperty("name");
		});
	});

	describe("POST /api/posts", () => {
		it("should create a new post when authenticated", async () => {
			const postData = {
				title: "New Test Post",
				content: "# New Test Content",
				published: false,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data).toHaveProperty("message", "Post created successfully");
			expect(data).toHaveProperty("post");
			expect(data.post.title).toBe(postData.title);
			expect(data.post.content).toBe(postData.content);
			expect(data.post.published).toBe(postData.published);
			expect(data.post.slug).toBe("new-test-post");

			// Verify post was created in database
			const post = await prisma.post.findUnique({
				where: { slug: "new-test-post" },
			});
			expect(post).toBeTruthy();
			expect(post?.authorId).toBe(userId);
		});

		it("should trim title and content on creation", async () => {
			const postData = {
				title: "   Trimmed Title   ",
				content: "   # Trimmed Content   ",
				published: false,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data).toHaveProperty("post");
			expect(data.post.title).toBe("Trimmed Title");
			expect(data.post.content).toBe("# Trimmed Content");
			expect(data.post.slug).toBe("trimmed-title");
		});

		it("should sanitize script tags in title and meta fields", async () => {
			const postData = {
				title: "<script>alert(1)</script> Malicious Title",
				content: "# Safe Content",
				metaTitle: "Meta <script>alert(2)</script> Title",
				metaDescription: "Desc <script>alert(3)</script> ription",
				published: true,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();
			expect(response.status).toBe(201);
			expect(data.post.title).toBe("Malicious Title");
			expect(data.post.metaTitle).toBe("Meta Title");
			expect(data.post.metaDescription).toBe("Desc ription");
			expect(data.post.slug).toContain("malicious-title");
		});

		it("should reject title with only whitespace", async () => {
			const postData = {
				title: "    ",
				content: "# Content",
				published: false,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty("error", "ValidationError");
		});

		it("should return error when not authenticated", async () => {
			const postData = {
				title: "New Test Post",
				content: "# New Test Content",
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(401);
			expect(data).toHaveProperty("error", "Access token required");
		});

		it("should return validation error for missing title", async () => {
			const postData = {
				content: "# New Test Content",
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty("error", "ValidationError");
		});

		it("should return error if post with same title already exists", async () => {
			// First create a post
			await prisma.post.create({
				data: {
					title: "Existing Post",
					content: "# Existing Content",
					slug: "existing-post",
					published: true,
					authorId: userId,
				},
			});

			const postData = {
				title: "Existing Post",
				content: "# New Content",
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty(
				"error",
				"A post with this title already exists"
			);
		});

		it("should create post with SEO metadata", async () => {
			const postData = {
				title: "SEO Test Post",
				content: "# SEO Test Content",
				published: false,
				metaTitle: "Custom SEO Title",
				metaDescription:
					"This is a custom meta description for SEO purposes",
				ogImage: "https://example.com/image.jpg",
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data).toHaveProperty("message", "Post created successfully");
			expect(data).toHaveProperty("post");
			expect(data.post.metaTitle).toBe(postData.metaTitle);
			expect(data.post.metaDescription).toBe(postData.metaDescription);
			expect(data.post.ogImage).toBe(postData.ogImage);

			// Verify post was created in database
			const post = await prisma.post.findUnique({
				where: { slug: "seo-test-post" },
			});
			expect(post).toBeTruthy();
			expect(post?.metaTitle).toBe(postData.metaTitle);
			expect(post?.metaDescription).toBe(postData.metaDescription);
			expect(post?.ogImage).toBe(postData.ogImage);
		});

		it("should create post without SEO metadata (backward compatibility)", async () => {
			const postData = {
				title: "Backward Compatible Post",
				content: "# Backward Compatible Content",
				published: false,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data).toHaveProperty("message", "Post created successfully");
			expect(data).toHaveProperty("post");
			expect(data.post.metaTitle).toBeNull();
			expect(data.post.metaDescription).toBeNull();
			expect(data.post.ogImage).toBeNull();
		});

		it("should validate meta title length", async () => {
			const postData = {
				title: "Validation Test Post",
				content: "# Validation Test Content",
				metaTitle:
					"This is a very long meta title that exceeds the 60 character limit and should fail validation",
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty("error", "ValidationError");
		});

		it("should validate meta description length", async () => {
			const postData = {
				title: "Validation Test Post",
				content: "# Validation Test Content",
				metaDescription:
					"This is a very long meta description that exceeds the 160 character limit and should fail validation because it is too long for search engines to display properly in search results",
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty("error", "ValidationError");
		});

		it("should validate ogImage URL format", async () => {
			const postData = {
				title: "Validation Test Post",
				content: "# Validation Test Content",
				ogImage: "not-a-valid-url",
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty("error", "ValidationError");
		});

		it("should accept valid ogImage URL", async () => {
			const postData = {
				title: "Valid URL Test Post",
				content: "# Valid URL Test Content",
				ogImage: "https://example.com/valid-image.jpg",
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data).toHaveProperty("message", "Post created successfully");
			expect(data.post.ogImage).toBe(postData.ogImage);
		});

		it("should trim SEO fields and ogImage URL", async () => {
			const postData = {
				title: "SEO Trim Test",
				content: "# SEO Trim Content",
				metaTitle: "   Custom SEO Title   ",
				metaDescription: "   This is a custom meta description   ",
				ogImage: "   https://example.com/image.jpg   ",
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();
			expect(response.status).toBe(201);
			expect(data.post.metaTitle).toBe("Custom SEO Title");
			expect(data.post.metaDescription).toBe(
				"This is a custom meta description"
			);
			expect(data.post.ogImage).toBe("https://example.com/image.jpg");
		});

		it("should create a post with featured status", async () => {
			const postData = {
				title: "Featured Test Post",
				content: "# Featured Test Content",
				published: true,
				featured: true,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data).toHaveProperty("message", "Post created successfully");
			expect(data).toHaveProperty("post");
			expect(data.post.featured).toBe(true);
			expect(data.post.title).toBe(postData.title);

			// Verify post was created in database with featured status
			const post = await prisma.post.findUnique({
				where: { slug: "featured-test-post" },
			});
			expect(post).toBeTruthy();
			expect(post?.featured).toBe(true);
		});

		it("should default featured to false when not provided", async () => {
			const postData = {
				title: "Non Featured Post",
				content: "# Non Featured Content",
				published: true,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data.post.featured).toBe(false);

			// Verify post was created in database with default featured status
			const post = await prisma.post.findUnique({
				where: { slug: "non-featured-post" },
			});
			expect(post?.featured).toBe(false);
		});

		it("should create post with tags", async () => {
			const tags = await prisma.tag.findMany({ take: 3 });
			const tagIds = tags.map((tag) => tag.id);

			const postData = {
				title: "Post with Tags",
				content: "# Content with Tags",
				published: false,
				tags: tagIds,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data).toHaveProperty("message", "Post created successfully");
			expect(data).toHaveProperty("post");
			expect(data.post.tags).toBeDefined();
			expect(Array.isArray(data.post.tags)).toBe(true);
			expect(data.post.tags.length).toBe(3);
			expect(data.post.tags[0]).toHaveProperty("id");
			expect(data.post.tags[0]).toHaveProperty("name");

			// Verify tags were created in database
			const post = await prisma.post.findUnique({
				where: { slug: "post-with-tags" },
				include: {
					tags: {
						include: {
							tag: true,
						},
					},
				},
			});
			expect(post?.tags.length).toBe(3);
		});

		it("should validate maximum 5 tags allowed", async () => {
			const tags = await prisma.tag.findMany({ take: 6 });
			const tagIds = tags.map((tag) => tag.id);

			const postData = {
				title: "Post with Too Many Tags",
				content: "# Content",
				published: false,
				tags: tagIds,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty("error", "ValidationError");
		});

		it("should accept exactly 5 tags", async () => {
			const tags = await prisma.tag.findMany({ take: 5 });
			const tagIds = tags.map((tag) => tag.id);

			const postData = {
				title: "Post with 5 Tags",
				content: "# Content",
				published: false,
				tags: tagIds,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data.post.tags.length).toBe(5);
		});
	});

	describe("PUT /api/posts/:id", () => {
		it("should update post when user owns it", async () => {
			// First create a post
			const post = await prisma.post.create({
				data: {
					title: "Original Title",
					content: "# Original Content",
					slug: "original-title",
					published: false,
					authorId: userId,
				},
			});

			const updateData = {
				title: "Updated Post Title",
				content: "# Updated Content",
				published: true,
			};

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(updateData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("message", "Post updated successfully");
			expect(data).toHaveProperty("post");
			expect(data.post.title).toBe(updateData.title);
			expect(data.post.content).toBe(updateData.content);
			expect(data.post.published).toBe(updateData.published);
			expect(data.post.slug).toBe("updated-post-title");

			// Verify post was updated in database
			const updatedPost = await prisma.post.findUnique({
				where: { id: post.id },
			});
			expect(updatedPost?.title).toBe(updateData.title);
			expect(updatedPost?.published).toBe(updateData.published);
		});

		it("should return error when user does not own post", async () => {
			// Create another user
			const otherUser = await prisma.user.create({
				data: {
					email: "other@example.com",
					username: "otheruser",
					password: await bcrypt.hash("Password123", 12),
				},
			});

			// Create a post owned by the other user
			const post = await prisma.post.create({
				data: {
					title: "Other User Post",
					content: "# Other Content",
					slug: "other-user-post",
					published: false,
					authorId: otherUser.id,
				},
			});

			const updateData = {
				title: "Updated Post Title",
				content: "# Updated Content",
			};

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(updateData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(403);
			expect(data).toHaveProperty(
				"error",
				"Not authorized to update this post"
			);
		});

		it("should update post featured status", async () => {
			// First create a post that is not featured
			const post = await prisma.post.create({
				data: {
					title: "Regular Post",
					content: "# Regular Content",
					slug: "regular-post",
					published: true,
					featured: false,
					authorId: userId,
				},
			});

			// Verify initial state
			expect(post.featured).toBe(false);

			const updateData = {
				title: "Regular Post",
				content: "# Regular Content",
				featured: true,
			};

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(updateData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("message", "Post updated successfully");
			expect(data.post.featured).toBe(true);

			// Verify post was updated in database
			const updatedPost = await prisma.post.findUnique({
				where: { id: post.id },
			});
			expect(updatedPost?.featured).toBe(true);
		});

		it("should return 404 for non-existent post", async () => {
			const updateData = {
				title: "Updated Post Title",
				content: "# Updated Content",
			};

			const response = await fetch(`${baseUrl}/posts/non-existent-id`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(updateData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(404);
			expect(data).toHaveProperty("error", "Post not found");
		});

		it("should update post with SEO metadata", async () => {
			// First create a post
			const post = await prisma.post.create({
				data: {
					title: "Original Post",
					content: "# Original Content",
					slug: "original-post",
					published: false,
					authorId: userId,
				},
			});

			const updateData = {
				title: "Updated Post with SEO",
				content: "# Updated Content",
				published: true,
				metaTitle: "Updated SEO Title",
				metaDescription: "Updated meta description for better SEO",
				ogImage: "https://example.com/updated-image.jpg",
			};

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(updateData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("message", "Post updated successfully");
			expect(data).toHaveProperty("post");
			expect(data.post.metaTitle).toBe(updateData.metaTitle);
			expect(data.post.metaDescription).toBe(updateData.metaDescription);
			expect(data.post.ogImage).toBe(updateData.ogImage);

			// Verify post was updated in database
			const updatedPost = await prisma.post.findUnique({
				where: { id: post.id },
			});
			expect(updatedPost?.metaTitle).toBe(updateData.metaTitle);
			expect(updatedPost?.metaDescription).toBe(
				updateData.metaDescription
			);
			expect(updatedPost?.ogImage).toBe(updateData.ogImage);
		});

		it("should update post and clear SEO metadata", async () => {
			// First create a post with SEO metadata
			const post = await prisma.post.create({
				data: {
					title: "Post with SEO",
					content: "# Content with SEO",
					slug: "post-with-seo",
					published: false,
					authorId: userId,
					metaTitle: "Original SEO Title",
					metaDescription: "Original meta description",
					ogImage: "https://example.com/original-image.jpg",
				},
			});

			const updateData = {
				title: "Updated Post without SEO",
				content: "# Updated Content",
				published: true,
				metaTitle: null,
				metaDescription: null,
				ogImage: null,
			};

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(updateData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("message", "Post updated successfully");
			expect(data).toHaveProperty("post");
			expect(data.post.metaTitle).toBe("");
			expect(data.post.metaDescription).toBe("");
			expect(data.post.ogImage).toBeNull();
		});

		it("should validate SEO fields on update", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Test Post",
					content: "# Test Content",
					slug: "test-post",
					published: false,
					authorId: userId,
				},
			});

			const updateData = {
				title: "Updated Post",
				content: "# Updated Content",
				metaTitle:
					"This is a very long meta title that exceeds the 60 character limit and should fail validation",
			};

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(updateData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty("error", "ValidationError");
		});

		it("should update post with tags", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Original Post",
					content: "# Original Content",
					slug: "original-post",
					published: false,
					authorId: userId,
				},
			});

			const tags = await prisma.tag.findMany({ take: 2 });
			const tagIds = tags.map((tag) => tag.id);

			const updateData = {
				title: "Updated Post",
				content: "# Updated Content",
				tags: tagIds,
			};

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(updateData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.post.tags).toBeDefined();
			expect(Array.isArray(data.post.tags)).toBe(true);
			expect(data.post.tags.length).toBe(2);

			// Verify tags were updated in database
			const updatedPost = await prisma.post.findUnique({
				where: { id: post.id },
				include: {
					tags: {
						include: {
							tag: true,
						},
					},
				},
			});
			expect(updatedPost?.tags.length).toBe(2);
		});

		it("should update post to remove all tags", async () => {
			const tags = await prisma.tag.findMany({ take: 2 });
			const tagIds = tags.map((tag) => tag.id);

			const post = await prisma.post.create({
				data: {
					title: "Post with Tags",
					content: "# Content",
					slug: "post-with-tags",
					published: false,
					authorId: userId,
					tags: {
						create: tagIds.map((tagId) => ({ tagId })),
					},
				},
			});

			const updateData = {
				title: "Post with Tags",
				content: "# Content",
				tags: [],
			};

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(updateData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.post.tags.length).toBe(0);

			// Verify tags were removed in database
			const updatedPost = await prisma.post.findUnique({
				where: { id: post.id },
				include: {
					tags: true,
				},
			});
			expect(updatedPost?.tags.length).toBe(0);
		});

		it("should validate maximum 5 tags on update", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Original Post",
					content: "# Original Content",
					slug: "original-post",
					published: false,
					authorId: userId,
				},
			});

			const tags = await prisma.tag.findMany({ take: 6 });
			const tagIds = tags.map((tag) => tag.id);

			const updateData = {
				title: "Updated Post",
				content: "# Updated Content",
				tags: tagIds,
			};

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(updateData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty("error", "ValidationError");
		});

		describe("Tag update transaction safety", () => {
			it("should preserve tags when post update fails due to non existent category", async () => {
				// Create a category
				const category = await prisma.category.findFirstOrThrow({});

				// Get existing tags
				const tags = await prisma.tag.findMany({ take: 2 });
				const tagIds = tags.map((tag) => tag.id);

				// Create a post with tags and category
				const post = await prisma.post.create({
					data: {
						title: "Post with Tags",
						content: "# Original Content",
						slug: "post-with-tags",
						published: false,
						authorId: userId,
						categoryId: category.id,
						tags: {
							create: tagIds.map((tagId) => ({ tagId })),
						},
					},
				});

				// Verify initial tags exist
				const initialPost = await prisma.post.findUnique({
					where: { id: post.id },
					include: { tags: true },
				});
				expect(initialPost?.tags.length).toBe(2);

				const updateData = {
					title: "Updated Post",
					content: "# Updated Content",
					categoryId: "non-existent-category-id",
					tags: tagIds,
				};

				const response = await fetch(`${baseUrl}/posts/${post.id}`, {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
					body: JSON.stringify(updateData),
				});

				const finalPost = await prisma.post.findUnique({
					where: { id: post.id },
					include: { tags: true },
				});

				// With transaction fix: tags should be preserved (transaction rolls back)
				// Without transaction: tags would be deleted and lost
				expect(finalPost?.tags.length).toBe(2);
			});

			it("should preserve tags when post update fails due to duplicate slug", async () => {
				// Get existing tags
				const tags = await prisma.tag.findMany({ take: 2 });
				const tagIds = tags.map((tag) => tag.id);

				// Create a post with tags
				const post = await prisma.post.create({
					data: {
						title: "Original Post",
						content: "# Original Content",
						slug: "original-post",
						published: false,
						authorId: userId,
						tags: {
							create: tagIds.map((tagId) => ({ tagId })),
						},
					},
				});

				// Verify initial tags exist
				const initialPost = await prisma.post.findUnique({
					where: { id: post.id },
					include: { tags: true },
				});
				expect(initialPost?.tags.length).toBe(2);

				const targetSlug = "updated-post";
				await prisma.post.create({
					data: {
						title: "Duplicate Slug Post",
						content: "# Content",
						slug: targetSlug,
						published: false,
						authorId: userId,
					},
				});

				const updateData = {
					title: "Updated Post",
					content: "# Updated Content",
					tags: tagIds,
				};

				const response = await fetch(`${baseUrl}/posts/${post.id}`, {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
					body: JSON.stringify(updateData),
				});

				const data: any = await response.json();

				console.log("Response status:", response.status, data);

				const finalPost = await prisma.post.findUnique({
					where: { id: post.id },
					include: { tags: true },
				});

				expect(finalPost?.tags.length).toBe(2);
			});

			it("should preserve tags when post update fails due to invalid tag reference after tag deletion", async () => {
				// Get existing tags
				const allTags = await prisma.tag.findMany({ take: 2 });
				const originalTagIds = allTags.map((tag) => tag.id);
				const invalidTagId = "invalid-tag-id";

				// Create a post with initial tags
				const post = await prisma.post.create({
					data: {
						title: "Post with Tags",
						content: "# Original Content",
						slug: "post-with-tags",
						published: false,
						authorId: userId,
						tags: {
							create: originalTagIds.map((tagId) => ({ tagId })),
						},
					},
				});

				// Verify initial tags exist
				const initialPost = await prisma.post.findUnique({
					where: { id: post.id },
					include: { tags: true },
				});
				expect(initialPost?.tags.length).toBe(2);

				const updateData = {
					title: "Updated Post",
					content: "# Updated Content",
					tags: [invalidTagId],
				};

				const response = await fetch(`${baseUrl}/posts/${post.id}`, {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
					body: JSON.stringify(updateData),
				});

				const finalPost = await prisma.post.findUnique({
					where: { id: post.id },
					include: {
						tags: {
							include: {
								tag: true,
							},
						},
					},
				});

				// With transaction fix: original tags should be preserved (transaction rolls back)
				// Without transaction: tags would be deleted and lost
				expect(finalPost?.tags.length).toBe(2);
			});
		});
	});

	describe("DELETE /api/posts/:id", () => {
		it("should delete post when user owns it", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Test Post",
					content: "# Test Content",
					slug: "test-post",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("message", "Post deleted successfully");

			// Verify post was deleted from database
			const deletedPost = await prisma.post.findUnique({
				where: { id: post.id },
			});
			expect(deletedPost).toBeNull();
		});

		it("should return error when user does not own post", async () => {
			const otherUser = await prisma.user.create({
				data: {
					email: "other@example.com",
					username: "otheruser",
					password: await bcrypt.hash("Password123", 12),
				},
			});

			const post = await prisma.post.create({
				data: {
					title: "Other User Post",
					content: "# Other Content",
					slug: "other-user-post",
					published: true,
					authorId: otherUser.id,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(403);
			expect(data).toHaveProperty(
				"error",
				"Not authorized to delete this post"
			);
		});

		it("should return 404 for non-existent post", async () => {
			const response = await fetch(`${baseUrl}/posts/non-existent-id`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(404);
			expect(data).toHaveProperty("error", "Post not found");
		});
	});

	describe("POST /api/posts/:slug - View Count", () => {
		it("should increment view count when viewing a published post", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Test Post",
					content: "# Test Content",
					slug: "test-post",
					published: true,
					authorId: userId,
					viewCount: 0,
				},
			});

			expect(post.viewCount).toBe(0);

			const response = await fetch(`${baseUrl}/posts/test-post`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("post");
			expect(data.post.slug).toBe("test-post");

			// Verify view count was incremented
			const updatedPost = await prisma.post.findUnique({
				where: { id: post.id },
			});
			expect(updatedPost?.viewCount).toBe(1);
			expect(data.post.viewCount).toBe(1);
		});

		it("should return error when trying to view unpublished post", async () => {
			await prisma.post.create({
				data: {
					title: "Draft Post",
					content: "# Draft Content",
					slug: "a-new-unpublished-draft-post",
					published: false,
					authorId: userId,
					viewCount: 0,
				},
			});

			const response = await fetch(
				`${baseUrl}/posts/a-new-unpublished-draft-post`
			);

			const data: any = await response.json();

			expect(response.status).toBe(404);
			expect(data).toHaveProperty("error", "Post not found");
		});

		it("should have initial view count of 0 for new posts", async () => {
			const postData = {
				title: "New Post",
				content: "# New Content",
				published: false,
			};

			const response = await fetch(`${baseUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(postData),
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data.post.viewCount).toBe(0);
		});

		it("should include viewCount in post list response", async () => {
			await prisma.post.create({
				data: {
					title: "Viewed Post",
					content: "# Viewed Content",
					slug: "viewed-post",
					published: true,
					authorId: userId,
					viewCount: 42,
				},
			});

			const response = await fetch(`${baseUrl}/posts`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts[0]).toHaveProperty("viewCount", 42);
		});
	});

	describe("POST /api/posts/:id/like - Like a post", () => {
		it("should allow authenticated user to like a post", async () => {
			// Create a post
			const post = await prisma.post.create({
				data: {
					title: "Likeable Post",
					content: "# Likeable Content",
					slug: "likeable-post",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}/like`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data).toHaveProperty("message", "Post liked successfully");
			expect(data).toHaveProperty("likeCount", 1);

			// Verify like was created in database
			const like = await prisma.postLike.findUnique({
				where: {
					userId_postId: {
						userId: userId,
						postId: post.id,
					},
				},
			});
			expect(like).toBeTruthy();
		});

		it("should return error when user is not authenticated to like a post", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Likeable Post",
					content: "# Likeable Content",
					slug: "likeable-post",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}/like`, {
				method: "POST",
			});

			const data: any = await response.json();

			expect(response.status).toBe(401);
			expect(data).toHaveProperty("error", "Access token required");
		});

		it("should return error when trying to like the same post twice", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Likeable Post",
					content: "# Likeable Content",
					slug: "likeable-post",
					published: true,
					authorId: userId,
				},
			});

			// First like
			await fetch(`${baseUrl}/posts/${post.id}/like`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			// Try to like again
			const response = await fetch(`${baseUrl}/posts/${post.id}/like`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty(
				"error",
				"You have already liked this post"
			);
		});

		it("should increment like count when liking", async () => {
			// Create another user
			const otherUser = await prisma.user.create({
				data: {
					email: "other@example.com",
					username: "otheruser",
					password: await bcrypt.hash("Password123", 12),
				},
			});
			const otherAuthToken = jwt.sign(
				{ userId: otherUser.id },
				process.env.JWT_SECRET!
			);

			const post = await prisma.post.create({
				data: {
					title: "Likeable Post",
					content: "# Likeable Content",
					slug: "likeable-post",
					published: true,
					authorId: userId,
				},
			});

			// First user likes
			await fetch(`${baseUrl}/posts/${post.id}/like`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			// Second user likes
			const response = await fetch(`${baseUrl}/posts/${post.id}/like`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${otherAuthToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data).toHaveProperty("likeCount", 2);
		});
	});

	describe("DELETE /api/posts/:id/like - Unlike a post", () => {
		it("should allow authenticated user to unlike a post", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Likeable Post",
					content: "# Likeable Content",
					slug: "likeable-post",
					published: true,
					authorId: userId,
				},
			});

			// First like the post
			await prisma.postLike.create({
				data: {
					userId: userId,
					postId: post.id,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}/like`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("message", "Post unliked successfully");
			expect(data).toHaveProperty("likeCount", 0);

			// Verify like was deleted from database
			const like = await prisma.postLike.findUnique({
				where: {
					userId_postId: {
						userId: userId,
						postId: post.id,
					},
				},
			});
			expect(like).toBeNull();
		});

		it("should return error when user is not authenticated to unlike a post", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Likeable Post",
					content: "# Likeable Content",
					slug: "likeable-post",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}/like`, {
				method: "DELETE",
			});

			const data: any = await response.json();

			expect(response.status).toBe(401);
			expect(data).toHaveProperty("error", "Access token required");
		});

		it("should return error when trying to unlike a post that was not liked", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Likeable Post",
					content: "# Likeable Content",
					slug: "likeable-post",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}/like`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty(
				"error",
				"You have not liked this post"
			);
		});
	});

	describe("Like count in posts", () => {
		it("should include like count when fetching published posts", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Liked Post",
					content: "# Liked Content",
					slug: "liked-post",
					published: true,
					authorId: userId,
				},
			});

			// Add likes
			await prisma.postLike.createMany({
				data: [
					{
						userId: userId,
						postId: post.id,
					},
				],
			});

			const response = await fetch(`${baseUrl}/posts`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts[0]).toHaveProperty("likeCount", 1);
		});

		it("should include like count when fetching a single post", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Single Liked Post",
					content: "# Single Liked Content",
					slug: "single-liked-post",
					published: true,
					authorId: userId,
				},
			});

			// Add likes
			await prisma.postLike.create({
				data: {
					userId: userId,
					postId: post.id,
				},
			});

			const response = await fetch(`${baseUrl}/posts/single-liked-post`);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.post).toHaveProperty("likeCount", 1);
		});
	});

	describe("POST /api/posts/:id/save - Save a post", () => {
		it("should allow authenticated user to save a post", async () => {
			// Create a post
			const post = await prisma.post.create({
				data: {
					title: "Saveable Post",
					content: "# Saveable Content",
					slug: "saveable-post",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}/save`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(201);
			expect(data).toHaveProperty("message", "Post saved successfully");

			// Verify save was created in database
			const savedPost = await prisma.savedPost.findUnique({
				where: {
					userId_postId: {
						userId: userId,
						postId: post.id,
					},
				},
			});
			expect(savedPost).toBeTruthy();
		});

		it("should return error when user is not authenticated to save a post", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Saveable Post",
					content: "# Saveable Content",
					slug: "saveable-post",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}/save`, {
				method: "POST",
			});

			const data: any = await response.json();

			expect(response.status).toBe(401);
			expect(data).toHaveProperty("error", "Access token required");
		});

		it("should return error when trying to save the same post twice", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Saveable Post",
					content: "# Saveable Content",
					slug: "saveable-post",
					published: true,
					authorId: userId,
				},
			});

			// First save
			await fetch(`${baseUrl}/posts/${post.id}/save`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			// Try to save again
			const response = await fetch(`${baseUrl}/posts/${post.id}/save`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data).toHaveProperty(
				"error",
				"You have already saved this post"
			);
		});
	});

	describe("DELETE /api/posts/:id/save - Unsave a post", () => {
		it("should allow authenticated user to unsave a post", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Saveable Post",
					content: "# Saveable Content",
					slug: "saveable-post",
					published: true,
					authorId: userId,
				},
			});

			// First save the post
			await prisma.savedPost.create({
				data: {
					userId: userId,
					postId: post.id,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}/save`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("message", "Post unsaved successfully");

			// Verify save was deleted from database
			const savedPost = await prisma.savedPost.findUnique({
				where: {
					userId_postId: {
						userId: userId,
						postId: post.id,
					},
				},
			});
			expect(savedPost).toBeNull();
		});

		it("should return error when user is not authenticated to unsave a post", async () => {
			const post = await prisma.post.create({
				data: {
					title: "Saveable Post",
					content: "# Saveable Content",
					slug: "saveable-post",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(`${baseUrl}/posts/${post.id}/save`, {
				method: "DELETE",
			});

			const data: any = await response.json();

			expect(response.status).toBe(401);
			expect(data).toHaveProperty("error", "Access token required");
		});
	});

	describe("GET /api/posts/saved - Get saved posts", () => {
		it("should return saved posts for authenticated user", async () => {
			// Create posts
			const post1 = await prisma.post.create({
				data: {
					title: "Saved Post 1",
					content: "# Saved Content 1",
					slug: "saved-post-1",
					published: true,
					authorId: userId,
				},
			});

			const post2 = await prisma.post.create({
				data: {
					title: "Saved Post 2",
					content: "# Saved Content 2",
					slug: "saved-post-2",
					published: true,
					authorId: userId,
				},
			});

			// Save the posts
			await prisma.savedPost.createMany({
				data: [
					{
						userId: userId,
						postId: post1.id,
					},
					{
						userId: userId,
						postId: post2.id,
					},
				],
			});

			const response = await fetch(`${baseUrl}/posts/saved`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("posts");
			expect(data).toHaveProperty("pagination");
			expect(data.posts).toHaveLength(2);
			expect(data.posts[0]).toHaveProperty("title");
			expect(data.posts[0]).toHaveProperty("savedAt");
			expect(data.pagination).toHaveProperty("page", 1);
			expect(data.pagination).toHaveProperty("limit", 10);
			expect(data.pagination).toHaveProperty("total", 2);
		});

		it("should return error when user is not authenticated", async () => {
			const response = await fetch(`${baseUrl}/posts/saved`, {
				method: "GET",
			});

			const data: any = await response.json();

      expect(response.status).toBe(401);
      expect(data).toHaveProperty('error', 'Access token required');
    });
  });  

  describe('GET /api/posts/:slug/related - Get related posts', () => {
    it('should return related posts that share tags with the given post', async () => {
      // Get some tags
      const tags = await prisma.tag.findMany({ take: 2 });
      const tagIds = tags.map(tag => tag.id);

			// Create a post with tags
			const originalPost = await prisma.post.create({
				data: {
					title: "Original Post",
					content: "# Original Content",
					slug: "original-post",
					published: true,
					authorId: userId,
					tags: {
						create: tagIds.map((tagId) => ({ tagId })),
					},
				},
			});

			// Create related posts that share the same tags
			const relatedPost1 = await prisma.post.create({
				data: {
					title: "Related Post 1",
					content: "# Related Content 1",
					slug: "related-post-1",
					published: true,
					authorId: userId,
					tags: {
						create: [{ tagId: tagIds[0] }], // Shares first tag
					},
				},
			});

			const relatedPost2 = await prisma.post.create({
				data: {
					title: "Related Post 2",
					content: "# Related Content 2",
					slug: "related-post-2",
					published: true,
					authorId: userId,
					tags: {
						create: [{ tagId: tagIds[1] }], // Shares second tag
					},
				},
			});

			// Create a post with different tags (should not be included)
			const unrelatedTag = await prisma.tag.findFirst({
				where: {
					id: {
						notIn: tagIds,
					},
				},
			});

			if (unrelatedTag) {
				await prisma.post.create({
					data: {
						title: "Unrelated Post",
						content: "# Unrelated Content",
						slug: "unrelated-post",
						published: true,
						authorId: userId,
						tags: {
							create: [{ tagId: unrelatedTag.id }],
						},
					},
				});
			}

			const response = await fetch(
				`${baseUrl}/posts/original-post/related`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("posts");
			expect(Array.isArray(data.posts)).toBe(true);
			expect(data.posts.length).toBeGreaterThanOrEqual(2);

			// Verify related posts are returned
			const postSlugs = data.posts.map((p: any) => p.slug);
			expect(postSlugs).toContain("related-post-1");
			expect(postSlugs).toContain("related-post-2");
			expect(postSlugs).not.toContain("original-post"); // Current post should not be included
			expect(postSlugs).not.toContain("unrelated-post"); // Unrelated post should not be included

			// Verify posts have proper structure
			expect(data.posts[0]).toHaveProperty("id");
			expect(data.posts[0]).toHaveProperty("title");
			expect(data.posts[0]).toHaveProperty("slug");
			expect(data.posts[0]).toHaveProperty("author");
			expect(data.posts[0]).toHaveProperty("tags");
			expect(data.posts[0]).toHaveProperty("likeCount");
		});

		it("should return empty array when post has no tags", async () => {
			// Create a post without tags
			const postWithoutTags = await prisma.post.create({
				data: {
					title: "Post Without Tags",
					content: "# Content",
					slug: "post-without-tags",
					published: true,
					authorId: userId,
				},
			});

			const response = await fetch(
				`${baseUrl}/posts/post-without-tags/related`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("posts");
			expect(Array.isArray(data.posts)).toBe(true);
			expect(data.posts.length).toBe(0);
		});

		it("should return 404 when post does not exist", async () => {
			const response = await fetch(
				`${baseUrl}/posts/non-existent-slug/related`
			);

			const data: any = await response.json();

			expect(response.status).toBe(404);
			expect(data).toHaveProperty("error", "Post not found");
		});

		it("should exclude unpublished posts from related posts", async () => {
			// Get some tags
			const tags = await prisma.tag.findMany({ take: 1 });
			const tagId = tags[0].id;

			// Create a published post with tags
			const originalPost = await prisma.post.create({
				data: {
					title: "Original Published Post",
					content: "# Original Content",
					slug: "original-published-post",
					published: true,
					authorId: userId,
					tags: {
						create: [{ tagId }],
					},
				},
			});

			// Create a related published post
			const relatedPublished = await prisma.post.create({
				data: {
					title: "Related Published Post",
					content: "# Related Published Content",
					slug: "related-published-post",
					published: true,
					authorId: userId,
					tags: {
						create: [{ tagId }],
					},
				},
			});

			// Create an unpublished post with the same tag (should not be included)
			await prisma.post.create({
				data: {
					title: "Related Unpublished Post",
					content: "# Related Unpublished Content",
					slug: "related-unpublished-post",
					published: false,
					authorId: userId,
					tags: {
						create: [{ tagId }],
					},
				},
			});

			const response = await fetch(
				`${baseUrl}/posts/original-published-post/related`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts.length).toBeGreaterThanOrEqual(1);

			const postSlugs = data.posts.map((p: any) => p.slug);
			expect(postSlugs).toContain("related-published-post");
			expect(postSlugs).not.toContain("related-unpublished-post");
			expect(data.posts.every((p: any) => p.published === true)).toBe(
				true
			);
		});

		it("should limit related posts to 5", async () => {
			// Get some tags
			const tags = await prisma.tag.findMany({ take: 1 });
			const tagId = tags[0].id;

			// Create original post
			const originalPost = await prisma.post.create({
				data: {
					title: "Original Post for Limit Test",
					content: "# Original Content",
					slug: "original-post-limit-test",
					published: true,
					authorId: userId,
					tags: {
						create: [{ tagId }],
					},
				},
			});

			const relatedPosts: any = [];
			for (let i = 1; i <= 7; i++) {
				const post = await prisma.post.create({
					data: {
						title: `Related Post ${i}`,
						content: `# Related Content ${i}`,
						slug: `related-post-${i}`,
						published: true,
						authorId: userId,
						tags: {
							create: [{ tagId }],
						},
					},
				});
				relatedPosts.push(post);
			}

			const response = await fetch(
				`${baseUrl}/posts/original-post-limit-test/related`
			);

			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts.length).toBe(5); // Should be limited to 5
		});
	});

	describe("posts controller tests", () => {
		it("should export post CRUD controller functions", () => {
			const postsController = require("../controllers/postsController");
			expect(postsController.createPost).toBeDefined();
			expect(postsController.updatePost).toBeDefined();
			expect(postsController.deletePost).toBeDefined();
			expect(postsController.getPostBySlug).toBeDefined();
			expect(postsController.getDraftBySlug).toBeDefined();
		});

		it("should export post listing controller functions", () => {
			const postsController = require("../controllers/postsController");
			expect(postsController.getAllPosts).toBeDefined();
			expect(postsController.getTrendingPosts).toBeDefined();
			expect(postsController.getMyPosts).toBeDefined();
			expect(postsController.getSavedPosts).toBeDefined();
		});

		it("should export related posts controller function", () => {
			const postsController = require("../controllers/postsController");
			expect(postsController.getRelatedPosts).toBeDefined();
		});

		it("should export post interaction controller functions", () => {
			const postsController = require("../controllers/postsController");
			expect(postsController.likePost).toBeDefined();
			expect(postsController.unlikePost).toBeDefined();
			expect(postsController.savePost).toBeDefined();
			expect(postsController.unsavePost).toBeDefined();
		});

		it("should export comment controller functions", () => {
			const postsController = require("../controllers/postsController");
			expect(postsController.getPostComments).toBeDefined();
			expect(postsController.createComment).toBeDefined();
			expect(postsController.replyToComment).toBeDefined();
			expect(postsController.likeComment).toBeDefined();
			expect(postsController.unlikeComment).toBeDefined();
		});
	});
});
