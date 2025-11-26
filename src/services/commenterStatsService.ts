import { prisma } from '../lib/prisma';

const TOP_COMMENTER_THRESHOLD = 5;

export async function updateCommenterStats(commenterId: string, postAuthorId: string): Promise<void> {
  if (commenterId === postAuthorId) {
    return;
  }

  const existingStats = await prisma.userCommenterStats.findUnique({
    where: {
      postAuthorId_commenterId: {
        postAuthorId,
        commenterId,
      },
    },
  });

  if (existingStats) {
    await prisma.userCommenterStats.update({
      where: {
        postAuthorId_commenterId: {
          postAuthorId,
          commenterId,
        },
      },
      data: {
        commentCount: {
          increment: 1,
        },
        lastCommentAt: new Date(),
      },
    });
  } else {
    await prisma.userCommenterStats.create({
      data: {
        postAuthorId,
        commenterId,
        commentCount: 1,
        lastCommentAt: new Date(),
      },
    });
  }
}

export async function decrementCommenterStats(commenterId: string, postAuthorId: string): Promise<void> {
  if (commenterId === postAuthorId) {
    return;
  }

  const existingStats = await prisma.userCommenterStats.findUnique({
    where: {
      postAuthorId_commenterId: {
        postAuthorId,
        commenterId,
      },
    },
  });

  if (existingStats && existingStats.commentCount > 0) {
    if (existingStats.commentCount === 1) {
      await prisma.userCommenterStats.delete({
        where: {
          postAuthorId_commenterId: {
            postAuthorId,
            commenterId,
          },
        },
      });
    } else {
      await prisma.userCommenterStats.update({
        where: {
          postAuthorId_commenterId: {
            postAuthorId,
            commenterId,
          },
        },
        data: {
          commentCount: {
            decrement: 1,
          },
        },
      });
    }
  }
}

export async function isTopCommenter(commenterId: string, postAuthorId: string): Promise<boolean> {
  if (commenterId === postAuthorId) {
    return false;
  }

  const stats = await prisma.userCommenterStats.findUnique({
    where: {
      postAuthorId_commenterId: {
        postAuthorId,
        commenterId,
      },
    },
  });

  return stats ? stats.commentCount >= TOP_COMMENTER_THRESHOLD : false;
}

export async function getTopCommenters(postAuthorId: string, limit: number = 10) {
  const topCommenters = await prisma.userCommenterStats.findMany({
    where: {
      postAuthorId,
      commentCount: {
        gte: TOP_COMMENTER_THRESHOLD,
      },
    },
    include: {
      commenter: {
        select: {
          id: true,
          username: true,
          profilePicture: true,
        },
      },
    },
    orderBy: {
      commentCount: 'desc',
    },
    take: limit,
  });

  return topCommenters.map((stats) => ({
    user: stats.commenter,
    commentCount: stats.commentCount,
    lastCommentAt: stats.lastCommentAt,
  }));
}

export async function checkMultipleTopCommenters(
  commenterIds: string[],
  postAuthorId: string
): Promise<Map<string, boolean>> {
  const uniqueCommenterIds = [...new Set(commenterIds)].filter((id) => id !== postAuthorId);

  if (uniqueCommenterIds.length === 0) {
    return new Map();
  }

  const stats = await prisma.userCommenterStats.findMany({
    where: {
      postAuthorId,
      commenterId: {
        in: uniqueCommenterIds,
      },
    },
    select: {
      commenterId: true,
      commentCount: true,
    },
  });

  const resultMap = new Map<string, boolean>();

  uniqueCommenterIds.forEach((id) => {
    resultMap.set(id, false);
  });

  stats.forEach((stat) => {
    resultMap.set(stat.commenterId, stat.commentCount >= TOP_COMMENTER_THRESHOLD);
  });

  return resultMap;
}
