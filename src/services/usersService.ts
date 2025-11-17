import { prisma } from '../lib/prisma';

export class UsersService {
  async followUser(followerId: string, followingId: string): Promise<void> {
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

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
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

  async getFollowers(userId: string, page: number, limit: number) {
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

  async getFollowing(userId: string, page: number, limit: number) {
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
}

