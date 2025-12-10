import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

const uploadsDir = path.join(process.cwd(), 'uploads');

/**
 * Extract image filename from an image path
 * Handles both full paths (/api/images/filename.jpg) and just filenames
 */
export function extractFilename(imagePath: string | null | undefined): string | null {
    if (!imagePath) return null;

    // Handle /api/images/filename format
    if (imagePath.startsWith('/api/images/')) {
        return path.basename(imagePath);
    }

    // Handle direct filename or full path
    return path.basename(imagePath);
}

/**
 * Extract all image paths from a post
 */
export function extractPostImagePaths(post: {
    featuredImage?: string | null;
    ogImage?: string | null;
}): string[] {
    const images: string[] = [];

    if (post.featuredImage) {
        const filename = extractFilename(post.featuredImage);
        if (filename) images.push(filename);
    }

    if (post.ogImage) {
        const filename = extractFilename(post.ogImage);
        if (filename) images.push(filename);
    }

    return images;
}

/**
 * Delete a single image file from the uploads directory
 * @returns true if deleted successfully, false if file doesn't exist or error
 */
export async function deleteImageFile(filename: string): Promise<boolean> {
    try {
        const sanitizedFilename = path.basename(filename);
        const filePath = path.join(uploadsDir, sanitizedFilename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.warn(`Failed to delete image file: ${filename}`, error);
        return false;
    }
}

/**
 * Clean up all images associated with a post
 * @returns Array of deleted filenames
 */
export async function cleanupPostImages(post: {
    featuredImage?: string | null;
    ogImage?: string | null;
}): Promise<string[]> {
    const imageFilenames = extractPostImagePaths(post);
    const deletedFiles: string[] = [];

    for (const filename of imageFilenames) {
        const deleted = await deleteImageFile(filename);
        if (deleted) {
            deletedFiles.push(filename);
        }
    }

    return deletedFiles;
}

/**
 * Get all image filenames currently in the uploads directory
 */
export function getAllUploadedImages(): string[] {
    try {
        if (!fs.existsSync(uploadsDir)) {
            return [];
        }

        const files = fs.readdirSync(uploadsDir);
        return files.filter(file => {
            const filePath = path.join(uploadsDir, file);
            return fs.statSync(filePath).isFile();
        });
    } catch (error) {
        console.warn('Failed to read uploads directory', error);
        return [];
    }
}

/**
 * Get all image references from the database (featuredImage and ogImage fields)
 */
export async function getAllReferencedImages(): Promise<Set<string>> {
    const posts = await prisma.post.findMany({
        select: {
            featuredImage: true,
            ogImage: true,
        },
    });

    const referencedImages = new Set<string>();

    for (const post of posts) {
        const filenames = extractPostImagePaths(post);
        filenames.forEach(f => referencedImages.add(f));
    }

    return referencedImages;
}

/**
 * Find orphaned images (images in uploads not referenced by any post)
 */
export async function getOrphanedImages(): Promise<string[]> {
    const uploadedImages = getAllUploadedImages();
    const referencedImages = await getAllReferencedImages();

    return uploadedImages.filter(filename => !referencedImages.has(filename));
}

/**
 * Delete all orphaned images
 * @returns Object with deleted and failed arrays
 */
export async function cleanupOrphanedImages(): Promise<{
    deleted: string[];
    failed: string[];
}> {
    const orphanedImages = await getOrphanedImages();
    const deleted: string[] = [];
    const failed: string[] = [];

    for (const filename of orphanedImages) {
        const success = await deleteImageFile(filename);
        if (success) {
            deleted.push(filename);
        } else {
            failed.push(filename);
        }
    }

    return { deleted, failed };
}
