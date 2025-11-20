import { prisma } from '../lib/prisma';

/**
 * Generate a URL-friendly slug from a title
 * Handles edge cases: empty strings, unicode, special characters
 */
export function generateSlug(title: string): string {
  if (!title || typeof title !== 'string') {
    // Fallback: generate timestamp-based slug
    return `post-${Date.now()}`;
  }

  let slug = title
    .toLowerCase()
    .trim()
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace spaces with hyphens
    .replace(/\s/g, '-')
    // Remove special characters except hyphens and alphanumeric
    .replace(/[^a-z0-9-]/g, '')
    // Replace multiple consecutive hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');

  // If slug is empty after processing, generate fallback
  if (!slug || slug.length === 0) {
    return `post-${Date.now()}`;
  }

  // Truncate to max 200 characters (database constraint)
  if (slug.length > 200) {
    slug = slug.substring(0, 200);
    // Remove trailing hyphen if truncation created one
    slug = slug.replace(/-+$/, '');
  }

  return slug;
}

/**
 * Check if a slug exists in the database
 */
type SlugChecker = (slug: string) => Promise<boolean>;

/**
 * Generate a unique slug by appending number suffixes if collisions occur
 * @param baseSlug - The base slug to start with
 * @param checkFunction - Async function that returns true if slug exists
 * @param maxAttempts - Maximum number of attempts before throwing error (default: 100)
 * @returns Promise resolving to a unique slug
 */
export async function generateUniqueSlug(
  baseSlug: string,
  checkFunction: SlugChecker,
  maxAttempts: number = 100
): Promise<string> {
  // Check if base slug is available
  const exists = await checkFunction(baseSlug);
  if (!exists) {
    return baseSlug;
  }

  // Try appending numbers: -2, -3, -4, etc.
  for (let i = 2; i <= maxAttempts; i++) {
    const candidateSlug = `${baseSlug}-${i}`;
    const candidateExists = await checkFunction(candidateSlug);
    
    if (!candidateExists) {
      return candidateSlug;
    }
  }

  // If we've exhausted all attempts, throw error
  throw new Error(
    `Unable to generate unique slug after ${maxAttempts} attempts. Base slug: ${baseSlug}`
  );
}

/**
 * Generate a unique slug for a post
 * @param title - Post title
 * @param excludePostId - Optional post ID to exclude from collision check (for updates)
 * @returns Promise resolving to a unique post slug
 */
export async function generateUniquePostSlug(
  title: string,
  excludePostId?: string
): Promise<string> {
  const baseSlug = generateSlug(title);

  const checkFunction = async (slug: string): Promise<boolean> => {
    const existingPost = await prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });

    // If checking for update, exclude current post
    if (existingPost && excludePostId && existingPost.id === excludePostId) {
      return false; // Not a collision if it's the same post
    }

    return !!existingPost;
  };

  return generateUniqueSlug(baseSlug, checkFunction);
}

