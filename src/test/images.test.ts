import request from "supertest";
import { setupPrismaMock } from "./utils/mockPrisma";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
// Import prisma and app AFTER mocks are set up
import { prisma } from "../lib/prisma";
import app from "../index";

const { prisma: prismaMock, app: appInstance } = setupPrismaMock(prisma, app);

describe("Image Routes", () => {
	// Validate that mocking is properly set up
	it("should have mocking properly configured", () => {
		expect(prismaMock.isMocked).toBe(true);
	});

	// Verify that the controller functions are exported
	it("should export controller functions from imageController", () => {
		const imageController = require("../controllers/imageController");
		expect(imageController.upload).toBeDefined();
		expect(imageController.get).toBeDefined();
		expect(typeof imageController.upload).toBe("function");
		expect(typeof imageController.get).toBe("function");
	});

	let authToken: string;
	let userId: string;
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
		userId = mockUser.id;
		authToken = jwt.sign({ userId: mockUser.id }, process.env.JWT_SECRET!);
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

	describe("POST /api/images/upload", () => {
		it("should upload an image successfully when authenticated", async () => {
			const pngBuffer = Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				"base64"
			);

			const response = await request(appInstance)
				.post("/api/images/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.attach("image", pngBuffer, "test.png")
				.expect(201);

			expect(response.body).toHaveProperty(
				"message",
				"Image uploaded successfully"
			);
			expect(response.body).toHaveProperty("path");
			expect(response.body).toHaveProperty("filename");
			expect(response.body.path).toMatch(/^\/api\/images\/.+/);
			expect(response.body.filename).toBeTruthy();

			// Verify file was created
			const filePath = path.join(uploadsDir, response.body.filename);
			expect(fs.existsSync(filePath)).toBe(true);
		});

		it("should reject upload when not authenticated", async () => {
			const pngBuffer = Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				"base64"
			);

			const response = await request(appInstance)
				.post("/api/images/upload")
				.attach("image", pngBuffer, "test.png")
				.expect(401);

			expect(response.body).toHaveProperty("error");
		});

		it("should reject non-image files", async () => {
			const textBuffer = Buffer.from("This is not an image", "utf-8");

			const response = await request(appInstance)
				.post("/api/images/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.attach("image", textBuffer, "test.txt")
				.expect(400);

			expect(response.body).toHaveProperty("error", "Invalid file type");
			expect(response.body.message).toContain(
				"Only JPEG, PNG, GIF, and WebP images"
			);
		});

		it("should reject upload when no file is provided", async () => {
			const response = await request(appInstance)
				.post("/api/images/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(400);

			expect(response.body).toHaveProperty("error", "No file uploaded");
		});
	});

	describe("GET /api/images/:filename", () => {
		it("should fetch an uploaded image publicly without authentication", async () => {
			// First upload an image
			const pngBuffer = Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				"base64"
			);

			const uploadResponse = await request(appInstance)
				.post("/api/images/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.attach("image", pngBuffer, "test.png")
				.expect(201);

			const filename = uploadResponse.body.filename;

			// Then fetch it
			const fetchResponse = await request(appInstance)
				.get(`/api/images/${filename}`)
				.buffer(true)
				.expect(200);

			expect(fetchResponse.headers["content-type"]).toContain("image/");
			expect(Buffer.isBuffer(fetchResponse.body)).toBe(true);
			expect(fetchResponse.body.length).toBeGreaterThan(0);
		});

		it("should return 404 for non-existent image", async () => {
			const response = await request(appInstance)
				.get("/api/images/non-existent-image-12345.png")
				.expect(404);

			expect(response.body).toHaveProperty("error", "Image not found");
		});

		it("should prevent directory traversal attacks", async () => {
			const response = await request(appInstance)
				.get("/api/images/../../../../etc/passwd")
				.expect(404);

			expect(response.body).toHaveProperty("error", "Route not found");
		});
	});
});
