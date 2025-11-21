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

  // Check if already following
  const existingFollow = await prisma.follow.findFirst({
    where: {
      followerId,
      followingId,
    },
  });

  if (existingFollow) {
    throw new Error('Already following this user');
  }

  // Create follow relationship
  await prisma.follow.create({
    data: {
      followerId,
      followingId,
    },
  });
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const existingFollow = await prisma.follow.findFirst({
    where: {
      followerId,
      followingId,
    },
  });

  if (!existingFollow) {
    throw new Error('Not following this user');
  }

  await prisma.follow.delete({
    where: {
      id: existingFollow.id,
    },
  });
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

export async function getUserPublicProfile(userId: string) {
  // Check if user exists and is active
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      profilePicture: true,
      about: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new Error('User not found');
  }

  // Get counts in parallel
  const [postsCount, followerCount, followingCount] = await Promise.all([
    prisma.post.count({
      where: {
        authorId: userId,
        published: true,
      },
    }),
    prisma.follow.count({
      where: { followingId: userId },
    }),
    prisma.follow.count({
      where: { followerId: userId },
    }),
  ]);

  return {
    id: user.id,
    username: user.username,
    profilePicture: user.profilePicture,
    about: user.about,
    createdAt: user.createdAt,
    postsCount,
    followerCount,
    followingCount,
  };
}
