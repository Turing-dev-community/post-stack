import { prisma } from '../../lib/prisma';
import { estimateReadingTime } from '../readingTime';

/**
 * Common Prisma include object for posts with relations
 */
export const getPostIncludes = () => ({
  author: {
    select: {
      id: true,
      username: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  tags: {
    include: {
      tag: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
});

/**
 * Common Prisma include object for posts with author deletedAt check
 */
export const getPostIncludesWithDeletedAt = () => ({
  author: {
    select: {
      id: true,
      username: true,
      deletedAt: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  tags: {
    include: {
      tag: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
});

/**
 * Transform post tags from PostTag[] to Tag[]
 */
export function transformPostTags(post: any): any {
  return {
    ...post,
    tags: post.tags ? post.tags.map((postTag: any) => postTag.tag) : [],
  };
}

/**
 * Get like counts for multiple posts in a single query
 * This prevents N+1 query problem when fetching like counts
 */
export async function getBatchLikeCounts(postIds: string[]): Promise<Map<string, number>> {
  if (postIds.length === 0) {
    return new Map();
  }

  const likeCounts = await prisma.postLike.groupBy({
    by: ['postId'],
    where: {
      postId: { in: postIds },
    },
    _count: {
      postId: true,
    },
  });

  const likeCountMap = new Map<string, number>();
  for (const item of likeCounts) {
    likeCountMap.set(item.postId, item._count.postId);
  }

  return likeCountMap;
}

/**
 * Enrich posts with like counts, reading time, and transformed tags
 * Uses batch query to avoid N+1 problem
 */
export async function enrichPostsWithMetadata(posts: any[]): Promise<any[]> {
  if (posts.length === 0) {
    return [];
  }

  // Single query to get all like counts
  const postIds = posts.map((post) => post.id);
  const likeCountMap = await getBatchLikeCounts(postIds);

  return posts.map((post) => ({
    ...transformPostTags(post),
    likeCount: likeCountMap.get(post.id) || 0,
    readingTime: estimateReadingTime(post.content),
  }));
}

/**
 * Enrich a single post with like count, reading time, and transformed tags
 */
export async function enrichPostWithMetadata(post: any): Promise<any> {
  const likeCount = await prisma.postLike.count({ where: { postId: post.id } });
  return {
    ...transformPostTags(post),
    likeCount,
    readingTime: estimateReadingTime(post.content),
  };
}

