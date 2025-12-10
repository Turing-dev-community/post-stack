import request from "supertest";
import { setupPrismaMock } from "./utils/mockPrisma";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

// Import prisma and app AFTER mocks are set up
import { prisma } from "../lib/prisma";
import app from "../index";

const { prisma: prismaMock, app: appInstance } = setupPrismaMock(prisma, app);

describe("Image Cleanup", () => {

    let authToken: string;
    const uploadsDir = path.join(process.cwd(), "uploads");

    const mockUser = {
        id: "user-123",
        email: "test@example.com",
        username: "testuser",
        password: "hashedPassword",
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        // Mock user for authentication
        (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

        // Generate token
        authToken = jwt.sign({ userId: mockUser.id }, process.env.JWT_SECRET!);

        // Ensure uploads directory exists
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
    });

    afterEach(async () => {
        // Clean up uploaded files
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            files.forEach((file) => {
                const filePath = path.join(uploadsDir, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
            });
        }
    });

    describe("imageCleanupService", () => {
        it("should export all required functions from service", () => {
            const service = require("../services/imageCleanupService");
            expect(service.extractFilename).toBeDefined();
            expect(service.extractPostImagePaths).toBeDefined();
            expect(service.deleteImageFile).toBeDefined();
            expect(service.cleanupPostImages).toBeDefined();
            expect(service.getAllUploadedImages).toBeDefined();
            expect(service.getAllReferencedImages).toBeDefined();
            expect(service.getOrphanedImages).toBeDefined();
            expect(service.cleanupOrphanedImages).toBeDefined();
        });

        it("extractFilename should extract filename from /api/images/ path", () => {
            const { extractFilename } = require("../services/imageCleanupService");
            expect(extractFilename("/api/images/test-123.jpg")).toBe("test-123.jpg");
            expect(extractFilename("/api/images/my-image.png")).toBe("my-image.png");
        });

        it("extractFilename should handle null/undefined", () => {
            const { extractFilename } = require("../services/imageCleanupService");
            expect(extractFilename(null)).toBeNull();
            expect(extractFilename(undefined)).toBeNull();
        });

        it("extractPostImagePaths should extract all image paths from post", () => {
            const { extractPostImagePaths } = require("../services/imageCleanupService");

            const post = {
                featuredImage: "/api/images/featured-123.jpg",
                ogImage: "/api/images/og-456.png",
            };

            const paths = extractPostImagePaths(post);
            expect(paths).toContain("featured-123.jpg");
            expect(paths).toContain("og-456.png");
            expect(paths.length).toBe(2);
        });

        it("extractPostImagePaths should handle missing images", () => {
            const { extractPostImagePaths } = require("../services/imageCleanupService");

            const post = {
                featuredImage: null,
                ogImage: undefined,
            };

            const paths = extractPostImagePaths(post);
            expect(paths.length).toBe(0);
        });

        it("deleteImageFile should delete existing file", async () => {
            const { deleteImageFile } = require("../services/imageCleanupService");

            // Create a test file
            const testFilename = "test-delete-" + Date.now() + ".jpg";
            const testFilePath = path.join(uploadsDir, testFilename);
            fs.writeFileSync(testFilePath, "test content");

            expect(fs.existsSync(testFilePath)).toBe(true);

            const result = await deleteImageFile(testFilename);

            expect(result).toBe(true);
            expect(fs.existsSync(testFilePath)).toBe(false);
        });

        it("deleteImageFile should return false for non-existent file", async () => {
            const { deleteImageFile } = require("../services/imageCleanupService");

            const result = await deleteImageFile("non-existent-file.jpg");

            expect(result).toBe(false);
        });

        it("cleanupPostImages should delete all associated images", async () => {
            const { cleanupPostImages } = require("../services/imageCleanupService");

            // Create test files
            const featuredFilename = "featured-" + Date.now() + ".jpg";
            const ogFilename = "og-" + Date.now() + ".png";

            fs.writeFileSync(path.join(uploadsDir, featuredFilename), "featured content");
            fs.writeFileSync(path.join(uploadsDir, ogFilename), "og content");

            const post = {
                featuredImage: `/api/images/${featuredFilename}`,
                ogImage: `/api/images/${ogFilename}`,
            };

            const deleted = await cleanupPostImages(post);

            expect(deleted).toContain(featuredFilename);
            expect(deleted).toContain(ogFilename);
            expect(fs.existsSync(path.join(uploadsDir, featuredFilename))).toBe(false);
            expect(fs.existsSync(path.join(uploadsDir, ogFilename))).toBe(false);
        });

        it("getAllUploadedImages should return all files in uploads directory", () => {
            const { getAllUploadedImages } = require("../services/imageCleanupService");

            // Create test files
            const testFiles = ["test1.jpg", "test2.png", "test3.gif"];
            testFiles.forEach(f => {
                fs.writeFileSync(path.join(uploadsDir, f), "content");
            });

            const uploaded = getAllUploadedImages();

            testFiles.forEach(f => {
                expect(uploaded).toContain(f);
            });
        });

        it("getOrphanedImages should find images not referenced by any post", async () => {
            const { getOrphanedImages } = require("../services/imageCleanupService");

            // Create orphaned file
            const orphanedFilename = "orphaned-" + Date.now() + ".jpg";
            fs.writeFileSync(path.join(uploadsDir, orphanedFilename), "orphaned content");

            // Mock prisma.post.findMany to return no posts
            (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);

            const orphaned = await getOrphanedImages();

            expect(orphaned).toContain(orphanedFilename);
        });

        it("cleanupOrphanedImages should delete all orphaned images", async () => {
            const { cleanupOrphanedImages } = require("../services/imageCleanupService");

            // Create orphaned files
            const orphanedFiles = [
                "orphan1-" + Date.now() + ".jpg",
                "orphan2-" + Date.now() + ".png",
            ];
            orphanedFiles.forEach(f => {
                fs.writeFileSync(path.join(uploadsDir, f), "orphaned content");
            });

            // Mock prisma.post.findMany to return no posts
            (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);

            const result = await cleanupOrphanedImages();

            expect(result.deleted.length).toBeGreaterThanOrEqual(2);
            orphanedFiles.forEach(f => {
                expect(fs.existsSync(path.join(uploadsDir, f))).toBe(false);
            });
        });
    });

    describe("GET /api/images/orphaned", () => {
        it("should return list of orphaned images when authenticated", async () => {
            // Create orphaned file
            const orphanedFilename = "orphaned-get-" + Date.now() + ".jpg";
            fs.writeFileSync(path.join(uploadsDir, orphanedFilename), "orphaned content");

            // Mock prisma.post.findMany to return no posts
            (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);

            const response = await request(appInstance)
                .get("/api/images/orphaned")
                .set("Authorization", `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty("message", "Orphaned images retrieved successfully");
            expect(response.body).toHaveProperty("count");
            expect(response.body).toHaveProperty("images");
            expect(Array.isArray(response.body.images)).toBe(true);
        });

        it("should reject request when not authenticated", async () => {
            await request(appInstance)
                .get("/api/images/orphaned")
                .expect(401);
        });
    });

    describe("DELETE /api/images/orphaned", () => {
        it("should delete orphaned images when authenticated", async () => {
            // Create orphaned files
            const orphanedFilename = "orphaned-delete-" + Date.now() + ".jpg";
            fs.writeFileSync(path.join(uploadsDir, orphanedFilename), "orphaned content");

            // Mock prisma.post.findMany to return no posts
            (prismaMock.post.findMany as jest.Mock).mockResolvedValue([]);

            const response = await request(appInstance)
                .delete("/api/images/orphaned")
                .set("Authorization", `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty("message", "Orphaned images cleanup completed");
            expect(response.body).toHaveProperty("deletedCount");
            expect(response.body).toHaveProperty("deleted");

            // Verify file was deleted
            expect(fs.existsSync(path.join(uploadsDir, orphanedFilename))).toBe(false);
        });

        it("should reject request when not authenticated", async () => {
            await request(appInstance)
                .delete("/api/images/orphaned")
                .expect(401);
        });
    });
});
