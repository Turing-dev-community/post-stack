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

export async function createTag(name: string) {
  // Check if tag with same name already exists
  const existingTag = await prisma.tag.findUnique({
    where: { name: name.trim().toLowerCase() },
  });

  if (existingTag) {
    throw new Error('Tag already exists');
  }

  const tag = await prisma.tag.create({
    data: {
      name: name.trim().toLowerCase(),
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return tag;
}

export async function updateTag(tagId: string, name: string) {
  // Check if tag exists
  const existingTag = await prisma.tag.findUnique({
    where: { id: tagId },
  });

  if (!existingTag) {
    throw new Error('Tag not found');
  }

  // Check if another tag with the new name already exists
  const duplicateTag = await prisma.tag.findUnique({
    where: { name: name.trim().toLowerCase() },
  });

  if (duplicateTag && duplicateTag.id !== tagId) {
    throw new Error('Tag name already exists');
  }

  const tag = await prisma.tag.update({
    where: { id: tagId },
    data: {
      name: name.trim().toLowerCase(),
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return tag;
}

export async function deleteTag(tagId: string) {
  // Check if tag exists
  const existingTag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
    },
  });

  if (!existingTag) {
    throw new Error('Tag not found');
  }

  // Delete the tag (cascade will handle post_tags relationships)
  await prisma.tag.delete({
    where: { id: tagId },
  });

  return {
    id: existingTag.id,
    name: existingTag.name,
    deletedPostsCount: existingTag._count.posts,
  };
}

