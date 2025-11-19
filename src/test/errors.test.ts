import { Response } from "express";
import { handleError } from "../utils/errors";
import {
	createMockAppError,
	createMockBadRequestError,
	createMockUnauthorizedError,
	createMockForbiddenError,
	createMockNotFoundError,
	createMockConflictError,
	createMockValidationError,
	createMockInternalServerError,
	createMockPrismaKnownRequestError,
	createMockPrismaValidationError,
	createMockMulterError,
	createMockJsonWebTokenError,
	createMockTokenExpiredError,
	createMockGenericError,
	createMockResponse,
} from "./utils/mockErrors";

describe("handleError", () => {
	let mockRes: Response;

	beforeEach(() => {
		mockRes = createMockResponse() as any;
		// Reset NODE_ENV to test default behavior
		process.env.NODE_ENV = "test";
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("Headers already sent", () => {
		it("should return early if headers are already sent", () => {
			mockRes.headersSent = true;

			const error = createMockBadRequestError("Test error");
			handleError(error, mockRes);

			expect(mockRes.status).not.toHaveBeenCalled();
			expect(mockRes.json).not.toHaveBeenCalled();
		});
	});

	describe("AppError handling", () => {
		it("should handle BadRequestError correctly", () => {
			const error = createMockBadRequestError("Bad request message", {
				field: "email",
			});
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "BadRequestError",
				message: "Bad request message",
				details: { field: "email" },
			});
		});

		it("should handle UnauthorizedError correctly", () => {
			const error = createMockUnauthorizedError("Unauthorized access");
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "UnauthorizedError",
				message: "Unauthorized access",
			});
		});

		it("should handle ForbiddenError correctly", () => {
			const error = createMockForbiddenError("Access forbidden");
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(403);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "ForbiddenError",
				message: "Access forbidden",
			});
		});

		it("should handle NotFoundError correctly", () => {
			const error = createMockNotFoundError("Resource not found", {
				id: "123",
			});
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(404);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "NotFoundError",
				message: "Resource not found",
				details: { id: "123" },
			});
		});

		it("should handle ConflictError correctly", () => {
			const error = createMockConflictError("Resource conflict", {
				field: "username",
			});
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(409);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "ConflictError",
				message: "Resource conflict",
				details: { field: "username" },
			});
		});

		it("should handle ValidationError correctly", () => {
			const error = createMockValidationError("Validation failed", {
				errors: ["field1", "field2"],
			});
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "ValidationError",
				message: "Validation failed",
				details: { errors: ["field1", "field2"] },
			});
		});

		it("should handle InternalServerError correctly", () => {
			const error = createMockInternalServerError(
				"Internal server error"
			);
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "InternalServerError",
				message: "Internal server error",
			});
		});

		it("should handle AppError with custom status code", () => {
			const error = createMockAppError("Custom error", 418, true, {
				custom: "data",
			});
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(418);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "Error",
				message: "Custom error",
				details: { custom: "data" },
			});
		});
	});

	describe("Prisma error handling", () => {
		it("should handle PrismaClientKnownRequestError with P2002 (unique constraint)", () => {
			const error = createMockPrismaKnownRequestError(
				"P2002",
				"Unique constraint violation",
				{
					target: ["email"],
				}
			);
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(409);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "ConflictError",
				message: "Email already exists",
				details: { field: "email", code: "P2002" },
			});
		});

		it("should handle PrismaClientKnownRequestError with P2025 (record not found)", () => {
			const error = createMockPrismaKnownRequestError(
				"P2025",
				"Record not found"
			);
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(404);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "NotFoundError",
				message: "Resource not found",
				details: { code: "P2025" },
			});
		});

		it("should handle PrismaClientKnownRequestError with P2003 (foreign key constraint)", () => {
			const error = createMockPrismaKnownRequestError(
				"P2003",
				"Foreign key constraint violation"
			);
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "BadRequestError",
				message: "Invalid reference to related resource",
				details: { code: "P2003" },
			});
		});

		it("should handle PrismaClientKnownRequestError with P2014 (required relation)", () => {
			const error = createMockPrismaKnownRequestError(
				"P2014",
				"Required relation violation"
			);
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "BadRequestError",
				message: "Required relation missing",
				details: { code: "P2014" },
			});
		});

		it("should handle PrismaClientKnownRequestError with P2000 (value too long)", () => {
			const error = createMockPrismaKnownRequestError(
				"P2000",
				"Value too long"
			);
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "ValidationError",
				message: "Value exceeds maximum length",
				details: { code: "P2000" },
			});
		});

		it("should handle PrismaClientKnownRequestError with P2001 (record does not exist)", () => {
			const error = createMockPrismaKnownRequestError(
				"P2001",
				"Record does not exist"
			);
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(404);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "NotFoundError",
				message: "Record does not exist",
				details: { code: "P2001" },
			});
		});

		it("should handle PrismaClientKnownRequestError with unknown code", () => {
			const error = createMockPrismaKnownRequestError(
				"P9999",
				"Unknown Prisma error"
			);
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "InternalServerError",
				message: "Database operation failed",
				details: { code: "P9999" },
			});
		});

		it("should handle PrismaClientValidationError", () => {
			const error = createMockPrismaValidationError(
				"Invalid data provided"
			);
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "ValidationError",
				message: "Invalid data provided",
				details: { message: "Invalid data provided" },
			});
		});
	});

	describe("Multer error handling", () => {
		it("should handle LIMIT_FILE_SIZE error", () => {
			const error = createMockMulterError("LIMIT_FILE_SIZE");
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "BadRequestError",
				message: "File too large",
				details: {
					message: "Image size must be less than 5MB",
					code: "LIMIT_FILE_SIZE",
				},
			});
		});

		it("should handle LIMIT_FILE_COUNT error", () => {
			const error = createMockMulterError("LIMIT_FILE_COUNT");
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "BadRequestError",
				message: "Too many files",
				details: {
					message: "Only one file is allowed",
					code: "LIMIT_FILE_COUNT",
				},
			});
		});

		it("should handle LIMIT_UNEXPECTED_FILE error", () => {
			const error = createMockMulterError("LIMIT_UNEXPECTED_FILE");
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "BadRequestError",
				message: "Unexpected file field",
				details: {
					message: "Invalid file field name",
					code: "LIMIT_UNEXPECTED_FILE",
				},
			});
		});

		it("should handle unknown Multer error", () => {
			const error = createMockMulterError("UNKNOWN_MULTER_ERROR");
			error.message = "Unknown multer error";
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "BadRequestError",
				message: "Upload error",
				details: {
					message: "Unknown multer error",
					code: "UNKNOWN_MULTER_ERROR",
				},
			});
		});
	});

	describe("JWT error handling", () => {
		it("should handle JsonWebTokenError", () => {
			const error = createMockJsonWebTokenError("Invalid token");
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "UnauthorizedError",
				message: "Invalid token",
			});
		});

		it("should handle TokenExpiredError", () => {
			const error = createMockTokenExpiredError("Token expired");
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "UnauthorizedError",
				message: "Token expired",
			});
		});
	});

	describe("Generic Error handling", () => {
		it("should handle generic Error in development mode", () => {
			process.env.NODE_ENV = "development";
			const error = createMockGenericError("Generic error message");
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			const jsonCall = (mockRes.json as jest.Mock).mock.calls[0][0];
			expect(jsonCall).toMatchObject({
				error: "InternalServerError",
				message: "Generic error message",
			});
		});

		it("should handle generic Error in production mode", () => {
			process.env.NODE_ENV = "production";
			const error = createMockGenericError("Generic error message");
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "InternalServerError",
				message: "Something went wrong",
			});
		});
	});

	describe("Unknown error handling", () => {
		it("should handle unknown error types (non-Error objects)", () => {
			const error = { someProperty: "value" } as any;
			handleError(error, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "InternalServerError",
				message: "An unexpected error occurred",
			});
		});

		it("should handle null errors", () => {
			handleError(null as any, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "InternalServerError",
				message: "An unexpected error occurred",
			});
		});

		it("should handle undefined errors", () => {
			handleError(undefined as any, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "InternalServerError",
				message: "An unexpected error occurred",
			});
		});

		it("should handle string errors", () => {
			handleError("String error" as any, mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "InternalServerError",
				message: "An unexpected error occurred",
			});
		});
	});

	describe("Error response format", () => {
		it("should include stack trace in development mode for AppError", () => {
			process.env.NODE_ENV = "development";
			const error = createMockBadRequestError("Test error");
			error.stack = "Error stack trace";
			handleError(error, mockRes);

			const jsonCall = (mockRes.json as jest.Mock).mock.calls[0][0];
			expect(jsonCall).toHaveProperty("error", "BadRequestError");
			expect(jsonCall).toHaveProperty("message", "Test error");
		});

		it("should not include stack trace in production mode", () => {
			process.env.NODE_ENV = "production";
			const error = createMockBadRequestError("Test error");
			error.stack = "Error stack trace";
			handleError(error, mockRes);

			const jsonCall = (mockRes.json as jest.Mock).mock.calls[0][0];
			expect(jsonCall).not.toHaveProperty("stack");
		});
	});
});
