import { prisma } from '../lib/prisma';

export async function followUser(followerId: string, followingId: string): Promise<void> {
  // Validate self-follow
  if (followerId === followingId) {
    throw new Error('Cannot follow yourself');
  }

  // Check if user exists and is active
  const userToFollow = await prisma.user.findUnique({
    where: { id: followingId },
  });

  if (!userToFollow) {
    throw new Error('User not found');
  }

  // Check if user account is deactivated
  if (userToFollow.deletedAt) {
    throw new Error('User not found');
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existingFollow = await tx.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (existingFollow) {
        throw new Error('Already following this user');
      }

      await tx.follow.create({
        data: {
          followerId,
          followingId,
        },
      });
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error('Already following this user');
    }
    throw error;
  }
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {

  try {
    const result = await prisma.follow.deleteMany({
      where: {
        followerId,
        followingId,
      },
    });

    if (result.count === 0) {
      throw new Error('Not following this user');
    }
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new Error('Not following this user');
    }
    throw error;
  }
}

export async function getFollowers(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [follows, total] = await Promise.all([
    prisma.follow.findMany({
      where: { followingId: userId },
      skip,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        follower: {
          select: {
            id: true,
            username: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.follow.count({
      where: { followingId: userId },
    }),
  ]);

  return {
    followers: follows.map((f) => ({
      id: f.follower.id,
      username: f.follower.username,
      createdAt: f.createdAt,
    })),
    total,
    page,
    limit,
  };
}

export async function getFollowing(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [follows, total] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId },
      skip,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        following: {
          select: {
            id: true,
            username: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.follow.count({
      where: { followerId: userId },
    }),
  ]);

  return {
    following: follows.map((f) => ({
      id: f.following.id,
      username: f.following.username,
      createdAt: f.createdAt,
    })),
    total,
    page,
    limit,
  };
}

export async function getUserActivity(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    throw new Error('User not found');
  }

  // Fetch user's posts, comments, post likes, and comment likes in parallel
  const [posts, comments, postLikes, commentLikes, postsCount, commentsCount, postLikesCount, commentLikesCount] = await Promise.all([
    prisma.post.findMany({
      where: {
        authorId: userId,
        published: true,
      },
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.comment.findMany({
      where: {
        userId,
        post: {
          published: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.postLike.findMany({
      where: {
        userId,
        post: {
          published: true,
        },
      },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.commentLike.findMany({
      where: {
        userId,
        comment: {
          post: {
            published: true,
          },
        },
      },
      include: {
        comment: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
            post: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.post.count({
      where: {
        authorId: userId,
        published: true,
      },
    }),
    prisma.comment.count({
      where: {
        userId,
        post: {
          published: true,
        },
      },
    }),
    prisma.postLike.count({
      where: {
        userId,
        post: {
          published: true,
        },
      },
    }),
    prisma.commentLike.count({
      where: {
        userId,
        comment: {
          post: {
            published: true,
          },
        },
      },
    }),
  ]);

  // Transform posts to activity items
  const postActivities = posts.map((post) => ({
    type: 'post' as const,
    id: post.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    published: post.published,
    featured: post.featured,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author,
    category: post.category,
    tags: post.tags.map((postTag: any) => postTag.tag),
    viewCount: post.viewCount,
  }));

  // Transform comments to activity items
  const commentActivities = comments.map((comment) => ({
    type: 'comment' as const,
    id: comment.id,
    content: comment.content,
    postId: comment.postId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: comment.user,
    post: comment.post,
  }));

  // Transform post likes to activity items
  const postLikeActivities = postLikes.map((postLike) => ({
    type: 'post_like' as const,
    id: postLike.id,
    postId: postLike.postId,
    createdAt: postLike.createdAt,
    post: {
      id: postLike.post.id,
      title: postLike.post.title,
      slug: postLike.post.slug,
      author: postLike.post.author,
      category: postLike.post.category,
    },
  }));

  // Transform comment likes to activity items
  const commentLikeActivities = commentLikes.map((commentLike) => ({
    type: 'comment_like' as const,
    id: commentLike.id,
    commentId: commentLike.commentId,
    createdAt: commentLike.createdAt,
    comment: {
      id: commentLike.comment.id,
      content: commentLike.comment.content,
      user: commentLike.comment.user,
    },
    post: commentLike.comment.post,
  }));

  // Merge and sort by createdAt (newest first)
  const allActivities = [
    ...postActivities,
    ...commentActivities,
    ...postLikeActivities,
    ...commentLikeActivities,
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Apply pagination
  const paginatedActivities = allActivities.slice(skip, skip + limit);
  const total = postsCount + commentsCount + postLikesCount + commentLikesCount;

  return {
    activities: paginatedActivities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
