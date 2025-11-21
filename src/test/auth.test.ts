import request from "supertest";
import { setupPrismaMock } from "./utils/mockPrisma";
import { prisma } from "../lib/prisma";
import app from "../index";
import bcrypt from "bcryptjs";
import { generateToken, generateAccessToken, generateRefreshToken } from "../utils/auth";
import jwt from "jsonwebtoken";

const { prisma: prismaMock } = setupPrismaMock(prisma, app);

describe("Authentication Routes (mocked)", () => {
	it("should have mocking properly configured", () => {
		expect((prismaMock as any).isMocked).toBe(true);
	});

	describe("POST /api/auth/signup", () => {
		it("should create a new user successfully", async () => {
			(
				prismaMock.user.findFirst as unknown as jest.Mock
			).mockResolvedValue(null);
			const created = {
				id: "user-1",
				email: "test@example.com",
				username: "testuser",
				createdAt: new Date(),
			};
			(prismaMock.user.create as unknown as jest.Mock).mockResolvedValue(
				created
			);
			(prismaMock.refreshToken.create as unknown as jest.Mock).mockResolvedValue({
				id: "token-1",
				token: "refresh-token",
				userId: "user-1",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
			});

			const response = await request(app)
				.post("/api/auth/signup")
				.send({
					email: "test@example.com",
					username: "testuser",
					password: "Password123",
				})
				.expect(201);

			expect(response.body).toHaveProperty(
				"message",
				"User created successfully"
			);
			expect(response.body).toHaveProperty("user");
			expect(response.body.user.email).toBe("test@example.com");
			expect(response.body).toHaveProperty("accessToken");
			expect(response.body).toHaveProperty("refreshToken");
		});

		it("should return error if email already exists", async () => {
			(
				prismaMock.user.findFirst as unknown as jest.Mock
			).mockResolvedValue({
				id: "user-1",
				email: "existing@example.com",
				username: "existinguser",
			});

			const response = await request(app)
				.post("/api/auth/signup")
				.send({
					email: "existing@example.com",
					username: "newuser",
					password: "Password123",
				})
				.expect(400);

			expect(response.body).toHaveProperty(
				"error",
				"User already exists"
			);
		});

		it("should return validation error for invalid email", async () => {
			const response = await request(app)
				.post("/api/auth/signup")
				.send({
					email: "invalid-email",
					username: "testuser",
					password: "Password123",
				})
				.expect(400);
			expect(response.body).toHaveProperty("error", "ValidationError");
		});

		it("should return validation error for weak password", async () => {
			const response = await request(app)
				.post("/api/auth/signup")
				.send({
					email: "test@example.com",
					username: "testuser",
					password: "weak",
				})
				.expect(400);
			expect(response.body).toHaveProperty("error", "ValidationError");
		});

		it("should trim email and username on signup", async () => {
			(
				prismaMock.user.findFirst as unknown as jest.Mock
			).mockResolvedValue(null);
			const created = {
				id: "user-2",
				email: "spaced@example.com",
				username: "spaceduser",
				createdAt: new Date(),
			};
			(prismaMock.user.create as unknown as jest.Mock).mockResolvedValue(
				created
			);

			const userData = {
				email: "   spaced@example.com   ",
				username: "   spaceduser   ",
				password: "Password123",
			};

			const response = await request(app)
				.post("/api/auth/signup")
				.send(userData)
				.expect(201);

			expect(response.body.user.email).toBe("spaced@example.com");
			expect(response.body.user.username).toBe("spaceduser");
			expect(prismaMock.user.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						email: "spaced@example.com",
						username: "spaceduser",
					}),
				})
			);
		});
	});

	describe("POST /api/auth/login", () => {
		it("should login successfully with valid credentials", async () => {
			const hashed = await bcrypt.hash("Password123", 12);
			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValue({
				id: "user-1",
				email: "test@example.com",
				username: "testuser",
				password: hashed,
			});
			(prismaMock.refreshToken.create as unknown as jest.Mock).mockResolvedValue({
				id: "token-1",
				token: "refresh-token",
				userId: "user-1",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
			});

			const response = await request(app)
				.post("/api/auth/login")
				.send({ email: "test@example.com", password: "Password123" })
				.expect(200);

			expect(response.body).toHaveProperty("message", "Login successful");
			expect(response.body).toHaveProperty("user");
			expect(response.body).toHaveProperty("accessToken");
			expect(response.body).toHaveProperty("refreshToken");
			expect(response.body.user.username).toBe("testuser");
		});

		it("should return error for invalid credentials", async () => {
			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValue(null);

			const response = await request(app)
				.post("/api/auth/login")
				.send({
					email: "nonexistent@example.com",
					password: "Password123",
				})
				.expect(401);

			expect(response.body).toHaveProperty(
				"error",
				"Invalid credentials"
			);
		});

		it("should return error for wrong password", async () => {
			const hashed = await bcrypt.hash("Password123", 12);
			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValue({
				id: "user-1",
				email: "test@example.com",
				username: "testuser",
				password: hashed,
			});

			const response = await request(app)
				.post("/api/auth/login")
				.send({ email: "test@example.com", password: "WrongPassword" })
				.expect(401);

			expect(response.body).toHaveProperty(
				"error",
				"Invalid credentials"
			);
		});

		it("should login successfully with trimmed email", async () => {
			const hashedPassword = await bcrypt.hash("Password123", 12);
			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValue({
				id: "user-2",
				email: "trimlogin@example.com",
				username: "trimlogin",
				password: hashedPassword,
				deletedAt: null,
			});
			(prismaMock.refreshToken.create as unknown as jest.Mock).mockResolvedValue({
				id: "token-2",
				token: "refresh-token",
				userId: "user-2",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
			});

			const response = await request(app)
				.post("/api/auth/login")
				.send({
					email: "   trimlogin@example.com   ",
					password: "Password123",
				})
				.expect(200);

			expect(response.body).toHaveProperty("message", "Login successful");
			expect(response.body.user.email).toBe("trimlogin@example.com");
		});
	});

	describe("DELETE /api/auth/account", () => {
		it("should deactivate account when authenticated", async () => {
			const userId = "user-1";

			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValueOnce({
				id: userId,
				email: "test@example.com",
				username: "testuser",
				deletedAt: null,
			});

			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValueOnce({
				id: userId,
				deletedAt: null,
			});
			(prismaMock.user.update as unknown as jest.Mock).mockResolvedValue({
				id: userId,
			});

			const token = generateToken(userId);
			const response = await request(app)
				.delete("/api/auth/account")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			expect(response.body).toHaveProperty(
				"message",
				"Account deactivated successfully"
			);
			expect(response.body).toHaveProperty("note");
		});

		it("should return error when not authenticated", async () => {
			const response = await request(app)
				.delete("/api/auth/account")
				.expect(401);
			expect(response.body).toHaveProperty(
				"error",
				"Access token required"
			);
		});

		it("should return error when trying to deactivate already deactivated account", async () => {
			const userId = "user-1";

			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValue({
				id: userId,
				email: "test@example.com",
				username: "testuser",
				deletedAt: new Date(),
			});

			const token = generateToken(userId);
			const response = await request(app)
				.delete("/api/auth/account")
				.set("Authorization", `Bearer ${token}`)
				.expect(403);
			expect(response.body).toHaveProperty(
				"error",
				"Account has been deactivated"
			);
		});

		it("should prevent login after account deactivation", async () => {
			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValue({
				id: "user-1",
				email: "test@example.com",
				username: "testuser",
				password: await bcrypt.hash("Password123", 12),
				deletedAt: new Date(),
			});

			const response = await request(app)
				.post("/api/auth/login")
				.send({ email: "test@example.com", password: "Password123" })
				.expect(403);
			expect(response.body).toHaveProperty(
				"error",
				"Account has been deactivated"
			);
		});

		it("should prevent authentication with token after account deactivation", async () => {
			const userId = "user-1";
			const token = generateToken(userId);
			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValue({
				id: userId,
				email: "test@example.com",
				username: "testuser",
				deletedAt: new Date(),
			});

			const response = await request(app)
				.get("/api/profile")
				.set("Authorization", `Bearer ${token}`)
				.expect(403);
			expect(response.body).toHaveProperty(
				"error",
				"Account has been deactivated"
			);
		});
	});

	describe("PUT /api/auth/password", () => {
		it("should change password successfully with valid credentials", async () => {
			const userId = "user-1";
			const currentPassword = "Password123";
			const newPassword = "NewPassword456";
			const hashedCurrentPassword = await bcrypt.hash(
				currentPassword,
				12
			);

			// Mock user lookup for authentication
			(prismaMock.user.findUnique as unknown as jest.Mock)
				.mockResolvedValueOnce({
					id: userId,
					email: "test@example.com",
					username: "testuser",
				})
				// Mock user lookup in controller
				.mockResolvedValueOnce({
					id: userId,
					email: "test@example.com",
					username: "testuser",
					password: hashedCurrentPassword,
					deletedAt: null,
				});

			// Mock password update
			(prismaMock.user.update as unknown as jest.Mock).mockResolvedValue({
				id: userId,
				email: "test@example.com",
				username: "testuser",
			});

			const token = generateToken(userId);
			const response = await request(app)
				.put("/api/auth/password")
				.set("Authorization", `Bearer ${token}`)
				.send({
					currentPassword,
					newPassword,
				})
				.expect(200);

			expect(response.body).toHaveProperty(
				"message",
				"Password changed successfully"
			);
			expect(prismaMock.user.update).toHaveBeenCalled();
		});

		it("should return error when current password is incorrect", async () => {
			const userId = "user-1";
			const currentPassword = "WrongPassword123";
			const newPassword = "NewPassword456";
			const hashedCurrentPassword = await bcrypt.hash("Password123", 12);

			// Mock user lookup for authentication
			(prismaMock.user.findUnique as unknown as jest.Mock)
				.mockResolvedValueOnce({
					id: userId,
					email: "test@example.com",
					username: "testuser",
				})
				// Mock user lookup in controller
				.mockResolvedValueOnce({
					id: userId,
					email: "test@example.com",
					username: "testuser",
					password: hashedCurrentPassword,
					deletedAt: null,
				});

			const token = generateToken(userId);
			const response = await request(app)
				.put("/api/auth/password")
				.set("Authorization", `Bearer ${token}`)
				.send({
					currentPassword,
					newPassword,
				})
				.expect(401);

			expect(response.body).toHaveProperty(
				"error",
				"Current password is incorrect"
			);
			expect(prismaMock.user.update).not.toHaveBeenCalled();
		});

		it("should return validation error for weak new password", async () => {
			const userId = "user-1";
			const token = generateToken(userId);

			// Mock user lookup for authentication
			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValueOnce({
				id: userId,
				email: "test@example.com",
				username: "testuser",
			});

			const response = await request(app)
				.put("/api/auth/password")
				.set("Authorization", `Bearer ${token}`)
				.send({
					currentPassword: "Password123",
					newPassword: "weak",
				})
				.expect(400);

			expect(response.body).toHaveProperty("error", "ValidationError");
			expect(response.body.details).toBeDefined();
		});

		it("should return validation error when new password is same as current", async () => {
			const userId = "user-1";
			const token = generateToken(userId);

			// Mock user lookup for authentication
			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValueOnce({
				id: userId,
				email: "test@example.com",
				username: "testuser",
			});

			const response = await request(app)
				.put("/api/auth/password")
				.set("Authorization", `Bearer ${token}`)
				.send({
					currentPassword: "Password123",
					newPassword: "Password123",
				})
				.expect(400);

			expect(response.body).toHaveProperty("error", "ValidationError");
			expect(response.body.details).toBeDefined();
		});

		it("should return error when not authenticated", async () => {
			const response = await request(app)
				.put("/api/auth/password")
				.send({
					currentPassword: "Password123",
					newPassword: "NewPassword456",
				})
				.expect(401);

			expect(response.body).toHaveProperty(
				"error",
				"Access token required"
			);
		});

		it("should return error when account is deactivated", async () => {
			const userId = "user-1";
			const currentPassword = "Password123";
			const newPassword = "NewPassword456";
			const hashedCurrentPassword = await bcrypt.hash(
				currentPassword,
				12
			);

			// Mock user lookup for authentication
			(prismaMock.user.findUnique as unknown as jest.Mock)
				.mockResolvedValueOnce({
					id: userId,
					email: "test@example.com",
					username: "testuser",
				})
				// Mock user lookup in controller (deactivated)
				.mockResolvedValueOnce({
					id: userId,
					email: "test@example.com",
					username: "testuser",
					password: hashedCurrentPassword,
					deletedAt: new Date(),
				});

			const token = generateToken(userId);
			const response = await request(app)
				.put("/api/auth/password")
				.set("Authorization", `Bearer ${token}`)
				.send({
					currentPassword,
					newPassword,
				})
				.expect(403);

			expect(response.body).toHaveProperty(
				"error",
				"Account has been deactivated"
			);
			expect(prismaMock.user.update).not.toHaveBeenCalled();
		});

		it("should return validation error when current password is missing", async () => {
			const userId = "user-1";
			const token = generateToken(userId);

			// Mock user lookup for authentication
			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValueOnce({
				id: userId,
				email: "test@example.com",
				username: "testuser",
			});

			const response = await request(app)
				.put("/api/auth/password")
				.set("Authorization", `Bearer ${token}`)
				.send({
					newPassword: "NewPassword456",
				})
				.expect(400);

			expect(response.body).toHaveProperty("error", "ValidationError");
		});

		it("should return validation error when new password is missing", async () => {
			const userId = "user-1";
			const token = generateToken(userId);

			// Mock user lookup for authentication
			(
				prismaMock.user.findUnique as unknown as jest.Mock
			).mockResolvedValueOnce({
				id: userId,
				email: "test@example.com",
				username: "testuser",
			});

			const response = await request(app)
				.put("/api/auth/password")
				.set("Authorization", `Bearer ${token}`)
				.send({
					currentPassword: "Password123",
				})
				.expect(400);

			expect(response.body).toHaveProperty("error", "ValidationError");
		});
	});

	describe("POST /api/auth/reactivate", () => {
		it("should reactivate account with valid credentials", async () => {
			const email = "test@example.com";
			const password = "Password123";
			const hashedPassword = await bcrypt.hash(password, 12);
			const userId = "user-1";

			// Mock user lookup (deactivated account)
			(prismaMock.user.findUnique as unknown as jest.Mock)
				.mockResolvedValueOnce({
					id: userId,
					email,
					username: "testuser",
					password: hashedPassword,
					deletedAt: new Date(),
				})
				// Mock user update
				.mockResolvedValueOnce({
					id: userId,
					email,
					username: "testuser",
					deletedAt: null,
				});

			(prismaMock.user.update as unknown as jest.Mock).mockResolvedValue({
				id: userId,
				email,
				username: "testuser",
				deletedAt: null,
			});
			(prismaMock.refreshToken.create as unknown as jest.Mock).mockResolvedValue({
				id: "token-1",
				token: "refresh-token",
				userId,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
			});

			const response = await request(app)
				.post("/api/auth/reactivate")
				.send({ email, password })
				.expect(200);

			expect(response.body).toHaveProperty("message", "Account reactivated successfully");
			expect(response.body).toHaveProperty("user");
			expect(response.body.user).toHaveProperty("id", userId);
			expect(response.body.user).toHaveProperty("email", email);
			expect(response.body.user).toHaveProperty("username", "testuser");
			expect(response.body).toHaveProperty("accessToken");
			expect(response.body).toHaveProperty("refreshToken");
		});

		it("should return error for invalid email format", async () => {
			const response = await request(app)
				.post("/api/auth/reactivate")
				.send({
					email: "invalid-email",
					password: "Password123",
				})
				.expect(400);

			expect(response.body).toHaveProperty("error", "ValidationError");
		});

		it("should return error for missing password", async () => {
			const response = await request(app)
				.post("/api/auth/reactivate")
				.send({
					email: "test@example.com",
				})
				.expect(400);

			expect(response.body).toHaveProperty("error", "ValidationError");
		});

		it("should return error for wrong password", async () => {
			const email = "test@example.com";
			const correctPassword = "Password123";
			const wrongPassword = "WrongPassword";
			const hashedPassword = await bcrypt.hash(correctPassword, 12);

			(prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
				id: "user-1",
				email,
				username: "testuser",
				password: hashedPassword,
				deletedAt: new Date(),
			});

			const response = await request(app)
				.post("/api/auth/reactivate")
				.send({ email, password: wrongPassword })
				.expect(401);

			expect(response.body).toHaveProperty("error", "Invalid credentials");
		});

		it("should return error if account doesn't exist", async () => {
			(prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue(null);

			const response = await request(app)
				.post("/api/auth/reactivate")
				.send({
					email: "nonexistent@example.com",
					password: "Password123",
				})
				.expect(401);

			expect(response.body).toHaveProperty("error", "Invalid credentials");
		});

		it("should return error if account is already active", async () => {
			const email = "test@example.com";
			const password = "Password123";
			const hashedPassword = await bcrypt.hash(password, 12);

			(prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
				id: "user-1",
				email,
				username: "testuser",
				password: hashedPassword,
				deletedAt: null, // Account is already active
			});

			const response = await request(app)
				.post("/api/auth/reactivate")
				.send({ email, password })
				.expect(400);

			expect(response.body).toHaveProperty("error", "Account is already active");
			expect(response.body).toHaveProperty(
				"message",
				"This account is already active. You can log in normally."
			);
		});

		it("should allow login after reactivation", async () => {
			const email = "test@example.com";
			const password = "Password123";
			const hashedPassword = await bcrypt.hash(password, 12);
			const userId = "user-1";

			// Mock reactivation
			(prismaMock.user.findUnique as unknown as jest.Mock)
				.mockResolvedValueOnce({
					id: userId,
					email,
					username: "testuser",
					password: hashedPassword,
					deletedAt: new Date(),
				})
				// Mock login after reactivation
				.mockResolvedValueOnce({
					id: userId,
					email,
					username: "testuser",
					password: hashedPassword,
					deletedAt: null, // Reactivated
				});

			(prismaMock.user.update as unknown as jest.Mock).mockResolvedValue({
				id: userId,
				email,
				username: "testuser",
				deletedAt: null,
			});
			(prismaMock.refreshToken.create as unknown as jest.Mock).mockResolvedValue({
				id: "token-1",
				token: "refresh-token",
				userId,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
			});

			// Reactivate account
			const reactivateResponse = await request(app)
				.post("/api/auth/reactivate")
				.send({ email, password })
				.expect(200);

			expect(reactivateResponse.body).toHaveProperty("message", "Account reactivated successfully");

			// Try to login
			const loginResponse = await request(app)
				.post("/api/auth/login")
				.send({ email, password })
				.expect(200);
			
			expect(loginResponse.body).toHaveProperty("message", "Login successful");
		});

		it("should allow authentication after reactivation", async () => {
			const email = "test@example.com";
			const password = "Password123";
			const hashedPassword = await bcrypt.hash(password, 12);
			const userId = "user-1";

			// Mock reactivation
			(prismaMock.user.findUnique as unknown as jest.Mock)
				.mockResolvedValueOnce({
					id: userId,
					email,
					username: "testuser",
					password: hashedPassword,
					deletedAt: new Date(),
				})
				// Mock authentication check
				.mockResolvedValueOnce({
					id: userId,
					email,
					username: "testuser",
					deletedAt: null, // Reactivated
				});

			(prismaMock.user.update as unknown as jest.Mock).mockResolvedValue({
				id: userId,
				email,
				username: "testuser",
				deletedAt: null,
			});
			(prismaMock.refreshToken.create as unknown as jest.Mock).mockResolvedValue({
				id: "token-1",
				token: "refresh-token",
				userId,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
			});

			// Reactivate account
			const reactivateResponse = await request(app)
				.post("/api/auth/reactivate")
				.send({ email, password })
				.expect(200);

			const token = reactivateResponse.body.accessToken;
			
			// Try to access protected route
			const profileResponse = await request(app)
				.get("/api/profile")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			expect(profileResponse.body).toHaveProperty("user");
		});
	});

	describe("POST /api/auth/refresh", () => {
		it("should refresh access token with valid refresh token", async () => {
			const userId = "user-1";
			const refreshToken = jwt.sign(
				{ userId },
				process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
				{ expiresIn: "7d" }
			);

			(prismaMock.refreshToken.findUnique as unknown as jest.Mock).mockResolvedValue({
				id: "token-1",
				token: refreshToken,
				userId,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
			});

			(prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
				id: userId,
				email: "test@example.com",
				username: "testuser",
				deletedAt: null,
			});

			const response = await request(app)
				.post("/api/auth/refresh")
				.send({ refreshToken })
				.expect(200);

			expect(response.body).toHaveProperty("message", "Access token refreshed successfully");
			expect(response.body).toHaveProperty("accessToken");
		});

		it("should return error for missing refresh token", async () => {
			const response = await request(app)
				.post("/api/auth/refresh")
				.send({})
				.expect(400);

			expect(response.body).toHaveProperty("error", "Refresh token required");
		});

		it("should return error for invalid refresh token", async () => {
			(prismaMock.refreshToken.findUnique as unknown as jest.Mock).mockResolvedValue(null);

			const response = await request(app)
				.post("/api/auth/refresh")
				.send({ refreshToken: "invalid-token" })
				.expect(403);

			expect(response.body).toHaveProperty("error", "Invalid or expired refresh token");
		});

		it("should return error for expired refresh token", async () => {
			const userId = "user-1";
			const refreshToken = jwt.sign(
				{ userId },
				process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
				{ expiresIn: "7d" }
			);

			(prismaMock.refreshToken.findUnique as unknown as jest.Mock).mockResolvedValue({
				id: "token-1",
				token: refreshToken,
				userId,
				expiresAt: new Date(Date.now() - 1000),
				createdAt: new Date(),
			});

			(prismaMock.refreshToken.delete as unknown as jest.Mock).mockResolvedValue({});

			const response = await request(app)
				.post("/api/auth/refresh")
				.send({ refreshToken })
				.expect(403);

			expect(response.body).toHaveProperty("error", "Invalid or expired refresh token");
		});

		it("should return error when user is deactivated", async () => {
			const userId = "user-1";
			const refreshToken = jwt.sign(
				{ userId },
				process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
				{ expiresIn: "7d" }
			);

			(prismaMock.refreshToken.findUnique as unknown as jest.Mock).mockResolvedValue({
				id: "token-1",
				token: refreshToken,
				userId,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
			});

			(prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
				id: userId,
				email: "test@example.com",
				username: "testuser",
				deletedAt: new Date(),
			});

			const response = await request(app)
				.post("/api/auth/refresh")
				.send({ refreshToken })
				.expect(403);

			expect(response.body).toHaveProperty("error", "Account has been deactivated");
		});
	});

	describe("POST /api/auth/logout", () => {
		it("should logout successfully with valid refresh token", async () => {
			const refreshToken = "valid-refresh-token";

			(prismaMock.refreshToken.deleteMany as unknown as jest.Mock).mockResolvedValue({ count: 1 });

			const response = await request(app)
				.post("/api/auth/logout")
				.send({ refreshToken })
				.expect(200);

			expect(response.body).toHaveProperty("message", "Logged out successfully");
			expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
				where: { token: refreshToken },
			});
		});

		it("should return error when refresh token is missing", async () => {
			const response = await request(app)
				.post("/api/auth/logout")
				.send({})
				.expect(400);

			expect(response.body).toHaveProperty("error", "Refresh token required");
		});
	});

	describe("POST /api/auth/logout-all", () => {
		it("should logout from all devices when authenticated", async () => {
			const userId = "user-1";

			(prismaMock.user.findUnique as unknown as jest.Mock).mockResolvedValue({
				id: userId,
				email: "test@example.com",
				username: "testuser",
				deletedAt: null,
			});

			(prismaMock.refreshToken.deleteMany as unknown as jest.Mock).mockResolvedValue({ count: 3 });

			const token = generateAccessToken(userId);
			const response = await request(app)
				.post("/api/auth/logout-all")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			expect(response.body).toHaveProperty("message", "Logged out from all devices successfully");
			expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
				where: { userId },
			});
		});

		it("should return error when not authenticated", async () => {
			const response = await request(app)
				.post("/api/auth/logout-all")
				.expect(401);

			expect(response.body).toHaveProperty("error", "Access token required");
		});
	});
});
