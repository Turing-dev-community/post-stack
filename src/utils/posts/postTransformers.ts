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
 * Enrich posts with like counts, reading time, and transformed tags
 */
export async function enrichPostsWithMetadata(posts: any[]): Promise<any[]> {
  return Promise.all(
    posts.map(async (post) => {
      const likeCount = await prisma.postLike.count({ where: { postId: post.id } });
      return {
        ...transformPostTags(post),
        likeCount,
        readingTime: estimateReadingTime(post.content),
      };
    })
  );
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

