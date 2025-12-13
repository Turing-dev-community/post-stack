import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";
import jwt from "jsonwebtoken";

// Mock the prisma module before importing app
jest.mock("../lib/prisma", () => ({
    __esModule: true,
    prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from "../lib/prisma";
import app from "../index";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// Helper to create a valid JWT token
const createTestToken = (userId: string) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET || "test-secret", {
        expiresIn: "1h",
    });
};

describe("POST /api/posts/:postId/clone", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    const mockUser = {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
        password: "hashedpassword",
        createdAt: new Date(),
        updatedAt: new Date(),
        about: null,
        profilePicture: null,
        deletedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
    };

    const mockOriginalPost = {
        id: "post-1",
        title: "Original Post",
        content: "This is the original content",
        slug: "original-post",
        published: true,
        featured: true,
        authorId: "user-1",
        categoryId: "cat-1",
        metaTitle: "Original Meta Title",
        metaDescription: "Original Meta Description",
        ogImage: "https://example.com/og.jpg",
        excerpt: "Original excerpt",
        featuredImage: "https://example.com/featured.jpg",
        viewCount: 100,
        allowComments: true,
        scheduledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [
            {
                id: "pt-1",
                postId: "post-1",
                tagId: "tag-1",
                createdAt: new Date(),
                tag: {
                    id: "tag-1",
                    name: "JavaScript",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        ],
        author: {
            id: "user-1",
            username: "testuser",
        },
        category: {
            id: "cat-1",
            name: "Technology",
            slug: "technology",
        },
    };

    const mockClonedPost = {
        id: "post-2",
        title: "Original Post (Copy)",
        content: "This is the original content",
        slug: "original-post-copy",
        published: false,
        featured: false,
        authorId: "user-1",
        categoryId: "cat-1",
        metaTitle: "Original Meta Title",
        metaDescription: "Original Meta Description",
        ogImage: "https://example.com/og.jpg",
        excerpt: "Original excerpt",
        featuredImage: "https://example.com/featured.jpg",
        viewCount: 0,
        allowComments: true,
        scheduledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [
            {
                id: "pt-2",
                postId: "post-2",
                tagId: "tag-1",
                createdAt: new Date(),
                tag: {
                    id: "tag-1",
                    name: "JavaScript",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        ],
        author: {
            id: "user-1",
            username: "testuser",
        },
        category: {
            id: "cat-1",
            name: "Technology",
            slug: "technology",
        },
    };

    it("should clone a post successfully", async () => {
        const token = createTestToken("user-1");

        // Mock user lookup for auth
        (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

        // Mock finding posts - returns original post for id lookup, null for slug lookup (no collision)
        (prismaMock.post.findUnique as jest.Mock).mockImplementation((args: any) => {
            if (args.where.id === "post-1") {
                return Promise.resolve(mockOriginalPost);
            }
            // Slug lookup for collision check - return null (no collision)
            if (args.where.slug) {
                return Promise.resolve(null);
            }
            return Promise.resolve(null);
        });

        // Mock creating the cloned post
        (prismaMock.post.create as jest.Mock).mockResolvedValue(mockClonedPost);

        // Mock like count
        (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

        const response = await request(app)
            .post("/api/posts/post-1/clone")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body.message).toBe("Post cloned successfully");
        expect(response.body.post).toBeDefined();
        expect(response.body.post.title).toBe("Original Post (Copy)");
        expect(response.body.post.published).toBe(false);
        expect(response.body.post.featured).toBe(false);
    });

    it("should return 404 if post to clone is not found", async () => {
        const token = createTestToken("user-1");

        (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prismaMock.post.findUnique as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
            .post("/api/posts/non-existent-post/clone")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Post not found");
    });

    it("should return 401 if not authenticated", async () => {
        const response = await request(app).post("/api/posts/post-1/clone");

        expect(response.status).toBe(401);
    });

    it("should create cloned post as unpublished draft", async () => {
        const token = createTestToken("user-1");

        (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prismaMock.post.findUnique as jest.Mock).mockImplementation((args: any) => {
            if (args.where.id === "post-1") return Promise.resolve(mockOriginalPost);
            return Promise.resolve(null);
        });
        (prismaMock.post.create as jest.Mock).mockResolvedValue(mockClonedPost);
        (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

        const response = await request(app)
            .post("/api/posts/post-1/clone")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body.post.published).toBe(false);
        expect(response.body.post.featured).toBe(false);
    });

    it("should copy tags from original post", async () => {
        const token = createTestToken("user-1");

        (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prismaMock.post.findUnique as jest.Mock).mockImplementation((args: any) => {
            if (args.where.id === "post-1") return Promise.resolve(mockOriginalPost);
            return Promise.resolve(null);
        });
        (prismaMock.post.create as jest.Mock).mockResolvedValue(mockClonedPost);
        (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

        const response = await request(app)
            .post("/api/posts/post-1/clone")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body.post.tags).toBeDefined();
        expect(response.body.post.tags.length).toBe(1);
        expect(response.body.post.tags[0].name).toBe("JavaScript");
    });

    it("should generate a new unique slug with (Copy) suffix", async () => {
        const token = createTestToken("user-1");

        (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prismaMock.post.findUnique as jest.Mock).mockImplementation((args: any) => {
            if (args.where.id === "post-1") return Promise.resolve(mockOriginalPost);
            return Promise.resolve(null);
        });
        (prismaMock.post.create as jest.Mock).mockResolvedValue(mockClonedPost);
        (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

        const response = await request(app)
            .post("/api/posts/post-1/clone")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body.post.title).toContain("(Copy)");
        expect(response.body.post.slug).not.toBe(mockOriginalPost.slug);
    });

    it("should copy content and metadata from original post", async () => {
        const token = createTestToken("user-1");

        (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prismaMock.post.findUnique as jest.Mock).mockImplementation((args: any) => {
            if (args.where.id === "post-1") return Promise.resolve(mockOriginalPost);
            return Promise.resolve(null);
        });
        (prismaMock.post.create as jest.Mock).mockResolvedValue(mockClonedPost);
        (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

        const response = await request(app)
            .post("/api/posts/post-1/clone")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body.post.content).toBe(mockOriginalPost.content);
        expect(response.body.post.metaTitle).toBe(mockOriginalPost.metaTitle);
        expect(response.body.post.metaDescription).toBe(mockOriginalPost.metaDescription);
    });

    it("should set the current user as the author of the cloned post", async () => {
        const token = createTestToken("user-1");

        (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prismaMock.post.findUnique as jest.Mock).mockImplementation((args: any) => {
            if (args.where.id === "post-1") return Promise.resolve(mockOriginalPost);
            return Promise.resolve(null);
        });
        (prismaMock.post.create as jest.Mock).mockResolvedValue(mockClonedPost);
        (prismaMock.postLike.count as jest.Mock).mockResolvedValue(0);

        const response = await request(app)
            .post("/api/posts/post-1/clone")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body.post.authorId).toBe("user-1");
    });

    it("should return 403 when trying to clone another user's post", async () => {
        const token = createTestToken("user-2"); // Different user

        const mockUser2 = {
            ...mockUser,
            id: "user-2",
            email: "user2@example.com",
            username: "testuser2",
        };

        const postByAnotherUser = {
            ...mockOriginalPost,
            authorId: "user-1", // Post belongs to user-1, not user-2
        };

        (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser2);
        (prismaMock.post.findUnique as jest.Mock).mockImplementation((args: any) => {
            if (args.where.id === "post-1") return Promise.resolve(postByAnotherUser);
            return Promise.resolve(null);
        });

        const response = await request(app)
            .post("/api/posts/post-1/clone")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe("Not authorized to clone this post");
    });
});
