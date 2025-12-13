import { prisma } from "../../lib/prisma";
import { generateSlug, generateUniquePostSlug } from "../../utils/slugUtils";
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

	// Excerpt logic: use provided excerpt, or fall back to metaDescription if available
	const finalExcerpt = data.excerpt !== undefined && data.excerpt !== null
		? data.excerpt
		: data.metaDescription || null;

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
			excerpt: finalExcerpt,
			featuredImage: data.featuredImage,
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
		slug = await generateUniquePostSlug(data.title, existingPost.id);
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

	// Excerpt logic: use provided excerpt, or fall back to metaDescription if available
	// If excerpt is explicitly set to null, use null
	// If excerpt is not provided in update, keep existing excerpt or use metaDescription
	let finalExcerpt: string | null | undefined;
	if (data.excerpt !== undefined) {
		// Excerpt is explicitly provided (could be null to clear it)
		finalExcerpt = data.excerpt !== null ? data.excerpt : null;
	} else if (data.metaDescription !== undefined) {
		// If metaDescription is being updated but excerpt is not provided,
		// use metaDescription as excerpt if current excerpt is null or matches old metaDescription
		const currentMetaDescription = existingPost.metaDescription;
		if (!existingPost.excerpt || existingPost.excerpt === currentMetaDescription) {
			finalExcerpt = data.metaDescription || null;
		}
		// Otherwise, keep existing excerpt
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
				...(finalExcerpt !== undefined ? { excerpt: finalExcerpt } : {}),
				featuredImage: data.featuredImage,
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
 * Create multiple posts in bulk
 */
export async function bulkCreatePosts(
	postsData: CreatePostData[],
	userId: string
) {
	if (!Array.isArray(postsData) || postsData.length === 0) {
		throw new Error("Posts must be a non-empty array");
	}

	if (postsData.length > 50) {
		throw new Error("Maximum 50 posts allowed per request");
	}

	// Check for duplicate slugs before creating
	const slugs = postsData.map((post) => generateSlug(post.title));
	const uniqueSlugs = new Set(slugs);

	if (uniqueSlugs.size !== slugs.length) {
		throw new Error("Duplicate post titles are not allowed");
	}

	// Check if any slugs already exist
	const existingPosts = await prisma.post.findMany({
		where: {
			slug: {
				in: slugs,
			},
		},
		select: {
			slug: true,
		},
	});

	if (existingPosts.length > 0) {
		const existingSlugs = existingPosts.map((p) => p.slug);
		throw new Error(
			`Posts with these titles already exist: ${existingSlugs.join(", ")}`
		);
	}

	// Create all posts in a transaction
	const createdPosts = await prisma.$transaction(
		postsData.map((postData) => {
			const slug = generateSlug(postData.title);

			// Excerpt logic: use provided excerpt, or fall back to metaDescription if available
			const finalExcerpt = postData.excerpt !== undefined && postData.excerpt !== null
				? postData.excerpt
				: postData.metaDescription || null;

			return prisma.post.create({
				data: {
					title: postData.title,
					content: postData.content,
					slug,
					published: postData.published ?? false,
					featured: postData.featured ?? false,
					authorId: userId,
					categoryId: postData.categoryId,
					metaTitle: postData.metaTitle,
					metaDescription: postData.metaDescription,
					ogImage: postData.ogImage,
					excerpt: finalExcerpt,
					featuredImage: postData.featuredImage,
					tags:
						postData.tags && postData.tags.length > 0
							? {
								create: postData.tags.map((tagId: string) => ({
									tagId,
								})),
							}
							: undefined,
				},
				include: getPostIncludes(),
			});
		})
	);

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidateUserCaches(userId);

	// Enrich all posts with metadata
	return await Promise.all(
		createdPosts.map((post) => enrichPostWithMetadata(post))
	);
}
/*
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

/**
 * Clone an existing post as a new draft
 * Creates a copy of the post with a new unique slug
 */
export async function clonePost(postId: string, userId: string) {
	const existingPost = await prisma.post.findUnique({
		where: { id: postId },
		include: {
			tags: {
				include: {
					tag: true,
				},
			},
		},
	});

	if (!existingPost) {
		throw new Error("Post not found");
	}

	// Check if user owns the post
	if (existingPost.authorId !== userId) {
		throw new Error("Not authorized to clone this post");
	}

	// Generate a unique slug for the cloned post
	const baseTitle = `${existingPost.title} (Copy)`;
	const slug = await generateUniquePostSlug(baseTitle);

	// Extract tag IDs from the original post
	const tagIds = existingPost.tags.map((postTag: any) => postTag.tagId);

	// Create the cloned post as a draft
	const clonedPost = await prisma.post.create({
		data: {
			title: baseTitle,
			content: existingPost.content,
			slug,
			published: false, // Always create as draft
			featured: false, // Don't copy featured status
			authorId: userId,
			categoryId: existingPost.categoryId,
			metaTitle: existingPost.metaTitle,
			metaDescription: existingPost.metaDescription,
			ogImage: existingPost.ogImage,
			excerpt: existingPost.excerpt,
			featuredImage: existingPost.featuredImage,
			tags:
				tagIds.length > 0
					? {
						create: tagIds.map((tagId: string) => ({
							tagId,
						})),
					}
					: undefined,
		},
		include: getPostIncludes(),
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidateUserCaches(userId);

	return await enrichPostWithMetadata(clonedPost);
}
