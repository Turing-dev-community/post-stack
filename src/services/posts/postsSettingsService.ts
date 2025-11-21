import { prisma } from "../../lib/prisma";
import { invalidateCache } from "../../middleware/cache";
import {
	enrichPostWithMetadata,
	getPostIncludes,
} from "../../utils/posts/postTransformers";

/**
 * Update comment settings for a post
 */
export async function updateCommentSettings(
	postId: string,
	allowComments: boolean,
	userId: string
) {
	const post = await prisma.post.findUnique({ where: { id: postId } });

	if (!post) {
		throw new Error("Post not found");
	}

	if (post.authorId !== userId) {
		throw new Error("Not authorized to update this post");
	}

	const updated = await prisma.post.update({
		where: { id: postId },
		data: { allowComments },
		include: getPostIncludes(),
	});

	invalidateCache.invalidateListCaches();
	invalidateCache.invalidatePostCache(updated.slug);
	invalidateCache.invalidateUserCaches(userId);

	return await enrichPostWithMetadata(updated);
}

