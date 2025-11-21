import { prisma } from "../../lib/prisma";
import { invalidateCache } from "../../middleware/cache";

/**
 * Like a post
 */
export async function likePost(postId: string, userId: string) {
	const post = await prisma.post.findUnique({
		where: { id: postId },
	});

	if (!post) {
		throw new Error("Post not found");
	}

	const existingLike = await prisma.postLike.findUnique({
		where: {
			userId_postId: {
				userId,
				postId,
			},
		},
	});

	if (existingLike) {
		throw new Error("You have already liked this post");
	}

	await prisma.postLike.create({
		data: {
			userId,
			postId,
		},
	});

	const likeCount = await prisma.postLike.count({
		where: { postId },
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidatePostCache(post.slug);

	return { likeCount };
}

/**
 * Unlike a post
 */
export async function unlikePost(postId: string, userId: string) {
	const post = await prisma.post.findUnique({
		where: { id: postId },
	});

	if (!post) {
		throw new Error("Post not found");
	}

	const existingLike = await prisma.postLike.findUnique({
		where: {
			userId_postId: {
				userId,
				postId,
			},
		},
	});

	if (!existingLike) {
		throw new Error("You have not liked this post");
	}

	await prisma.postLike.delete({
		where: {
			userId_postId: {
				userId,
				postId,
			},
		},
	});

	const likeCount = await prisma.postLike.count({
		where: { postId },
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidatePostCache(post.slug);

	return { likeCount };
}

/**
 * Save a post
 */
export async function savePost(postId: string, userId: string) {
	const post = await prisma.post.findUnique({
		where: { id: postId },
	});

	if (!post) {
		throw new Error("Post not found");
	}

	const existingSave = await prisma.savedPost.findUnique({
		where: {
			userId_postId: {
				userId,
				postId,
			},
		},
	});

	if (existingSave) {
		throw new Error("You have already saved this post");
	}

	await prisma.savedPost.create({
		data: {
			userId,
			postId,
		},
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidatePostCache(post.slug);
}

/**
 * Unsave a post
 */
export async function unsavePost(postId: string, userId: string) {
	const post = await prisma.post.findUnique({
		where: { id: postId },
	});

	if (!post) {
		throw new Error("Post not found");
	}

	const existingSave = await prisma.savedPost.findUnique({
		where: {
			userId_postId: {
				userId,
				postId,
			},
		},
	});

	if (!existingSave) {
		throw new Error("You have not saved this post");
	}

	await prisma.savedPost.delete({
		where: {
			userId_postId: {
				userId,
				postId,
			},
		},
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidatePostCache(post.slug);
}

