import { prisma } from '../lib/prisma';

export async function getTags(searchQuery?: string, popular?: boolean) {
  const whereClause: any = {};

  if (searchQuery && searchQuery.trim()) {
    whereClause.name = {
      contains: searchQuery.trim(),
      mode: 'insensitive',
    };
  }

  const tags = await prisma.tag.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          posts: true,
        },
      },
    },
  });

  // Map tags to include postCount
  const tagsWithCount = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    postCount: tag._count.posts,
  }));

  // Sort based on popular parameter
  if (popular) {
    // Sort by post count descending (most used first), then by name ascending for ties
    tagsWithCount.sort((a, b) => {
      if (b.postCount !== a.postCount) {
        return b.postCount - a.postCount;
      }
      return a.name.localeCompare(b.name);
    });
  } else {
    // Default: sort alphabetically by name
    tagsWithCount.sort((a, b) => a.name.localeCompare(b.name));
  }

  return tagsWithCount;
}

