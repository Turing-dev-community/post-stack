import { prisma } from "../../lib/prisma";
import {
	enrichPostsWithMetadata,
	enrichPostWithMetadata,
	getPostIncludes,
	getPostIncludesWithDeletedAt,
	transformPostTags,
} from "../../utils/posts/postTransformers";
import type { PostFilters, PaginationParams, SortParams } from "./types";

/**
 * Validate and build where clause for post queries
 */
function buildPostWhereClause(filters: PostFilters): any {
	const whereClause: any = {
		published: true,
		author: {
			deletedAt: null,
		},
	};

	if (filters.title?.trim()) {
		whereClause.title = {
			contains: filters.title.trim(),
			mode: "insensitive",
		};
	}

	if (filters.authorId) {
		whereClause.authorId = filters.authorId;
	}

	if (filters.categoryId) {
		whereClause.categoryId = filters.categoryId;
	}

	if (filters.fromDate || filters.toDate) {
		whereClause.createdAt = {};
		if (filters.fromDate) {
			whereClause.createdAt.gte = new Date(filters.fromDate);
		}
		if (filters.toDate) {
			whereClause.createdAt.lte = new Date(filters.toDate);
		}
	}

	return whereClause;
}

/**
 * Validate query parameters for getAllPosts
 */
export function validatePostQueryParams(
	titleQuery?: string,
	sortBy?: string,
	sortOrder?: string,
	fromDateQuery?: string,
	toDateQuery?: string
): { isValid: boolean; error?: string } {
	if (
		titleQuery !== undefined &&
		(!titleQuery || titleQuery.trim().length === 0)
	) {
		return { isValid: false, error: "Title search query cannot be empty" };
	}

	const validSortFields = ["createdAt", "updatedAt", "title"];
	if (sortBy && !validSortFields.includes(sortBy)) {
		return {
			isValid: false,
			error: `Invalid sort field. Must be one of: ${validSortFields.join(
				", "
			)}`,
		};
	}

	const validSortOrders = ["asc", "desc"];
	if (sortOrder && !validSortOrders.includes(sortOrder.toLowerCase())) {
		return {
			isValid: false,
			error: `Invalid sort order. Must be one of: ${validSortOrders.join(
				", "
			)}`,
		};
	}

	if (fromDateQuery) {
		const fromDate = new Date(fromDateQuery);
		if (isNaN(fromDate.getTime())) {
			return {
				isValid: false,
				error: "Invalid fromDate format. Use ISO 8601 format (e.g., YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)",
			};
		}
	}

	if (toDateQuery) {
		const toDate = new Date(toDateQuery);
		if (isNaN(toDate.getTime())) {
			return {
				isValid: false,
				error: "Invalid toDate format. Use ISO 8601 format (e.g., YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)",
			};
		}
	}

	if (fromDateQuery && toDateQuery) {
		const fromDate = new Date(fromDateQuery);
		const toDate = new Date(toDateQuery);
		if (fromDate > toDate) {
			return {
				isValid: false,
				error: "fromDate must be earlier than or equal to toDate",
			};
		}
	}

	return { isValid: true };
}

/**
 * Get all published posts with pagination, filtering, and sorting
 */
export async function getAllPosts(
	filters: PostFilters,
	pagination: PaginationParams,
	sortParams: SortParams
) {
	const { page, limit } = pagination;
	const { sortBy = "createdAt", sortOrder = "desc" } = sortParams;
	const skip = (page - 1) * limit;

	const whereClause = buildPostWhereClause(filters);

	// Handle tag filter separately
	if (filters.tag?.trim()) {
		const tag = await prisma.tag.findFirst({
			where: {
				name: {
					equals: filters.tag.trim(),
					mode: "insensitive",
				},
			},
		});

		if (tag) {
			whereClause.tags = {
				some: {
					tagId: tag.id,
				},
			};
		} else {
			// Tag doesn't exist, return empty results
			whereClause.tags = {
				some: {
					tagId: "non-existent-tag-id",
				},
			};
		}
	}

	const orderBy: any[] = [
		{ featured: "desc" },
		{ [sortBy]: sortOrder.toLowerCase() as "asc" | "desc" },
	];

	const posts = await prisma.post.findMany({
		where: whereClause,
		include: getPostIncludes(),
		orderBy,
		skip,
		take: limit,
	});

	const postsWithLikes = await enrichPostsWithMetadata(posts);
	const total = await prisma.post.count({ where: whereClause });

	return {
		posts: postsWithLikes,
		pagination: {
			page,
			limit,
			total,
			pages: Math.ceil(total / limit),
		},
	};
}

/**
 * Get trending posts (last 30 days, sorted by view count)
 */
export async function getTrendingPosts(pagination: PaginationParams) {
	const { page, limit } = pagination;
	const skip = (page - 1) * limit;

	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const whereClause: any = {
		published: true,
		createdAt: {
			gte: thirtyDaysAgo,
		},
		author: {
			deletedAt: null,
		},
	};

	const posts = await prisma.post.findMany({
		where: whereClause,
		include: getPostIncludes(),
		orderBy: [{ viewCount: "desc" }],
		skip,
		take: limit,
	});

	const total = await prisma.post.count({ where: whereClause });

	return {
		posts: await enrichPostsWithMetadata(posts),
		pagination: {
			page,
			limit,
			total,
			pages: Math.ceil(total / limit),
		},
	};
}

/**
 * Get popular posts sorted by like count
 */
export async function getPopularPosts(pagination: PaginationParams) {
	const { page, limit } = pagination;
	const skip = (page - 1) * limit;

	// Get sorted post IDs with like counts
	const postIdsWithLikes = await prisma.$queryRaw<
		Array<{ id: string; likeCount: number }>
	>`
    SELECT 
      p.id,
      COUNT(pl.id)::int as "likeCount"
    FROM posts p
    LEFT JOIN post_likes pl ON pl."postId" = p.id
    WHERE p.published = true
    GROUP BY p.id, p."createdAt"
    ORDER BY "likeCount" DESC, p."createdAt" DESC
    LIMIT ${limit} OFFSET ${skip}
  `;

	const totalResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count
    FROM posts p
    WHERE p.published = true
  `;
	const total = Number(totalResult[0].count);

	if (postIdsWithLikes.length === 0) {
		return {
			posts: [],
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		};
	}

	const postIds = postIdsWithLikes.map((p) => p.id);
	const posts = await prisma.post.findMany({
		where: {
			id: { in: postIds },
			published: true,
		},
		include: getPostIncludes(),
	});

	// Sort posts to match SQL query order
	const likeCountMap = new Map(
		postIdsWithLikes.map((p) => [p.id, p.likeCount])
	);
	posts.sort((a, b) => {
		const indexA = postIds.indexOf(a.id);
		const indexB = postIds.indexOf(b.id);
		return indexA - indexB;
	});

	const postsWithLikes = posts.map((post) => ({
		...transformPostTags(post),
		likeCount: likeCountMap.get(post.id) || 0,
	}));

	return {
		posts: postsWithLikes,
		pagination: {
			page,
			limit,
			total,
			pages: Math.ceil(total / limit),
		},
	};
}

/**
 * Get all posts for authenticated user (including unpublished)
 */
export async function getMyPosts(userId: string, pagination: PaginationParams) {
	const { page, limit } = pagination;
	const skip = (page - 1) * limit;

	const posts = await prisma.post.findMany({
		where: { authorId: userId },
		include: getPostIncludes(),
		orderBy: { createdAt: "desc" },
		skip,
		take: limit,
	});

	const postsWithLikes = await enrichPostsWithMetadata(posts);
	const total = await prisma.post.count({ where: { authorId: userId } });

	return {
		posts: postsWithLikes,
		pagination: {
			page,
			limit,
			total,
			pages: Math.ceil(total / limit),
		},
	};
}

/**
 * Get saved posts for authenticated user
 */
export async function getSavedPosts(
	userId: string,
	pagination: PaginationParams
) {
	const { page, limit } = pagination;
	const skip = (page - 1) * limit;

	const savedPosts = await prisma.savedPost.findMany({
		where: {
			userId,
			post: {
				author: {
					deletedAt: null,
				},
			},
		},
		include: {
			post: {
				include: getPostIncludes(),
			},
		},
		orderBy: { createdAt: "desc" },
		skip,
		take: limit,
	});

	const postsWithLikes = await Promise.all(
		savedPosts.map(async (savedPost) => {
			const enriched = await enrichPostWithMetadata(savedPost.post);
			return {
				...enriched,
				savedAt: savedPost.createdAt,
			};
		})
	);

	const total = await prisma.savedPost.count({
		where: {
			userId,
			post: {
				author: {
					deletedAt: null,
				},
			},
		},
	});

	return {
		posts: postsWithLikes,
		pagination: {
			page,
			limit,
			total,
			pages: Math.ceil(total / limit),
		},
	};
}

/**
 * Get related posts by slug
 */
export async function getRelatedPosts(slug: string) {
	const post = await prisma.post.findUnique({
		where: { slug, published: true },
		include: {
			tags: {
				include: {
					tag: true,
				},
			},
		},
	});

	if (!post) {
		throw new Error("Post not found");
	}

	const tagIds = post.tags.map((postTag: any) => postTag.tagId);

	if (tagIds.length === 0) {
		return { posts: [] };
	}

	const relatedPosts = await prisma.post.findMany({
		where: {
			published: true,
			id: {
				not: post.id,
			},
			author: {
				deletedAt: null,
			},
			tags: {
				some: {
					tagId: {
						in: tagIds,
					},
				},
			},
		},
		include: getPostIncludes(),
		orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
		take: 5,
	});

	const postsWithLikes = await enrichPostsWithMetadata(relatedPosts);

	return { posts: postsWithLikes };
}

/**
 * Get post by slug
 */
export async function getPostBySlug(slug: string) {
	const post = await prisma.post.findUnique({
		where: { slug },
		include: getPostIncludesWithDeletedAt(),
	});

	if (!post || !post.published || post.author.deletedAt) {
		throw new Error("Post not found");
	}

	// Increment view count
	await prisma.post.update({
		where: { id: post.id },
		data: {
			viewCount: {
				increment: 1,
			},
		},
	});
	post.viewCount += 1;

	// Remove deletedAt from author object
	const { deletedAt, ...authorWithoutDeletedAt } = post.author;
	const postWithoutDeletedAt = {
		...post,
		author: authorWithoutDeletedAt,
	};

	return await enrichPostWithMetadata(postWithoutDeletedAt);
}

/**
 * Get draft post by slug (authenticated, owner only)
 */
export async function getDraftBySlug(slug: string, userId: string) {
	const post = await prisma.post.findUnique({
		where: { slug, published: false },
		include: getPostIncludes(),
	});

	if (!post) {
		throw new Error("Post not found");
	}

	if (post.authorId !== userId) {
		throw new Error("Not authorized to view this post");
	}

	return await enrichPostWithMetadata(post);
}

