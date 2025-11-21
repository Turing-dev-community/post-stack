import { prisma } from "../../lib/prisma";
import { generateSlug } from "../../utils/auth";
import { invalidateCache } from "../../middleware/cache";
import {
	enrichPostWithMetadata,
	getPostIncludes,
} from "../../utils/posts/postTransformers";
import type { CreatePostData, UpdatePostData } from "./types";

/**
 * Create a new post
 */
export async function createPost(data: CreatePostData, userId: string) {
	const slug = generateSlug(data.title);

	const existingPost = await prisma.post.findUnique({
		where: { slug },
	});

	if (existingPost) {
		throw new Error("A post with this title already exists");
	}

	// If scheduledAt is provided, ensure published is false initially
	// The post will be auto-published when scheduledAt time arrives
	const scheduledDate = data.scheduledAt ? new Date(data.scheduledAt) : null;
	const now = new Date();
	const shouldPublishNow = scheduledDate && scheduledDate <= now;
	const finalPublished = data.scheduledAt
		? shouldPublishNow
			? true
			: false
		: data.published;

	const post = await prisma.post.create({
		data: {
			title: data.title,
			content: data.content,
			slug,
			published: finalPublished,
			featured: data.featured ?? false,
			authorId: userId,
			categoryId: data.categoryId,
			metaTitle: data.metaTitle,
			metaDescription: data.metaDescription,
			ogImage: data.ogImage,
			...(scheduledDate ? ({ scheduledAt: scheduledDate } as any) : {}),
			tags:
				data.tags && data.tags.length > 0
					? {
							create: data.tags.map((tagId: string) => ({
								tagId,
							})),
					  }
					: undefined,
		},
		include: getPostIncludes(),
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidateUserCaches(userId);

	return await enrichPostWithMetadata(post);
}

/**
 * Update an existing post
 */
export async function updatePost(
	postId: string,
	data: UpdatePostData,
	userId: string
) {
	const existingPost = await prisma.post.findUnique({
		where: { id: postId },
	});

	if (!existingPost) {
		throw new Error("Post not found");
	}

	if (existingPost.authorId !== userId) {
		throw new Error("Not authorized to update this post");
	}

	let slug = existingPost.slug;
	if (data.title && data.title !== existingPost.title) {
		slug = generateSlug(data.title);
	}

	// Handle scheduledAt logic
	const scheduledDate =
		data.scheduledAt !== undefined
			? data.scheduledAt
				? new Date(data.scheduledAt)
				: null
			: undefined;
	const now = new Date();
	let finalPublished = data.published;
	let finalScheduledAt = scheduledDate;

	if (data.scheduledAt !== undefined) {
		if (scheduledDate && scheduledDate <= now) {
			// If scheduled time has passed, publish immediately and clear scheduledAt
			finalPublished = true;
			finalScheduledAt = null;
		} else if (scheduledDate) {
			// If scheduled for future, ensure published is false
			finalPublished = false;
		} else {
			// If scheduledAt is being cleared (set to null), keep current published state
			finalScheduledAt = null;
		}
	}

	const post = await prisma.$transaction(async (tx) => {
		if (data.tags !== undefined) {
			await tx.postTag.deleteMany({
				where: { postId },
			});
		}

		return await tx.post.update({
			where: { id: postId },
			data: {
				title: data.title,
				content: data.content,
				slug,
				published:
					finalPublished !== undefined
						? finalPublished
						: data.published,
				featured: data.featured,
				categoryId: data.categoryId,
				metaTitle: data.metaTitle,
				metaDescription: data.metaDescription,
				ogImage: data.ogImage,
				...(finalScheduledAt !== undefined
					? ({ scheduledAt: finalScheduledAt } as any)
					: {}),
				tags:
					data.tags !== undefined
						? {
								create:
									data.tags && data.tags.length > 0
										? data.tags.map((tagId: string) => ({
												tagId,
										  }))
										: [],
						  }
						: undefined,
			},
			include: getPostIncludes(),
		});
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidatePostCache(post.slug);
	invalidateCache.invalidateUserCaches(userId);

	return await enrichPostWithMetadata(post);
}

/**
 * Delete a post
 */
export async function deletePost(postId: string, userId: string) {
	const existingPost = await prisma.post.findUnique({
		where: { id: postId },
	});

	if (!existingPost) {
		throw new Error("Post not found");
	}

	if (existingPost.authorId !== userId) {
		throw new Error("Not authorized to delete this post");
	}

	await prisma.post.delete({
		where: { id: postId },
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidatePostCache(existingPost.slug);
	invalidateCache.invalidateUserCaches(userId);
}

/**
 * Schedule a post for future publication
 */
export async function schedulePost(
	postId: string,
	scheduledAt: string,
	userId: string
) {
	const existingPost = await prisma.post.findUnique({
		where: { id: postId },
	});

	if (!existingPost) {
		throw new Error("Post not found");
	}

	if (existingPost.authorId !== userId) {
		throw new Error("Not authorized to schedule this post");
	}

	const scheduledDate = new Date(scheduledAt);
	const now = new Date();

	if (scheduledDate <= now) {
		throw new Error("scheduledAt must be in the future");
	}

	const post = await prisma.post.update({
		where: { id: postId },
		data: {
			scheduledAt: scheduledDate,
			published: false, // Ensure post is not published until scheduled time
		} as any,
		include: getPostIncludes(),
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidatePostCache(post.slug);
	invalidateCache.invalidateUserCaches(userId);

	return await enrichPostWithMetadata(post);
}

/**
 * Unschedule a post (remove scheduledAt and optionally publish immediately)
 */
export async function unschedulePost(
	postId: string,
	publishNow: boolean,
	userId: string
) {
	const existingPost = await prisma.post.findUnique({
		where: { id: postId },
	});

	if (!existingPost) {
		throw new Error("Post not found");
	}

	if (existingPost.authorId !== userId) {
		throw new Error("Not authorized to unschedule this post");
	}

	if (!(existingPost as any).scheduledAt) {
		throw new Error("Post is not scheduled");
	}

	const post = await prisma.post.update({
		where: { id: postId },
		data: {
			scheduledAt: null,
			published: publishNow === true ? true : existingPost.published,
		} as any,
		include: getPostIncludes(),
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidatePostCache(post.slug);
	invalidateCache.invalidateUserCaches(userId);

	return await enrichPostWithMetadata(post);
}
