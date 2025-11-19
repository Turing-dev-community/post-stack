import { Prisma } from "@prisma/client";
import { MulterError } from "multer";
import {
	AppError,
	BadRequestError,
	UnauthorizedError,
	ForbiddenError,
	NotFoundError,
	ConflictError,
	ValidationError,
	InternalServerError,
} from "../../utils/errors";

/**
 * Mock error factory functions for testing error handling
 */

/**
 * Creates a mock AppError instance
 */
export const createMockAppError = (
	message: string = "Test AppError",
	statusCode: number = 500,
	isOperational: boolean = true,
	details?: any
): AppError => {
	return new AppError(message, statusCode, isOperational, details);
};

/**
 * Creates a mock BadRequestError instance
 */
export const createMockBadRequestError = (
	message: string = "Bad Request",
	details?: any
): BadRequestError => {
	return new BadRequestError(message, details);
};

/**
 * Creates a mock UnauthorizedError instance
 */
export const createMockUnauthorizedError = (
	message: string = "Unauthorized",
	details?: any
): UnauthorizedError => {
	return new UnauthorizedError(message, details);
};

/**
 * Creates a mock ForbiddenError instance
 */
export const createMockForbiddenError = (
	message: string = "Forbidden",
	details?: any
): ForbiddenError => {
	return new ForbiddenError(message, details);
};

/**
 * Creates a mock NotFoundError instance
 */
export const createMockNotFoundError = (
	message: string = "Resource not found",
	details?: any
): NotFoundError => {
	return new NotFoundError(message, details);
};

/**
 * Creates a mock ConflictError instance
 */
export const createMockConflictError = (
	message: string = "Conflict",
	details?: any
): ConflictError => {
	return new ConflictError(message, details);
};

/**
 * Creates a mock ValidationError instance
 */
export const createMockValidationError = (
	message: string = "Validation failed",
	details?: any
): ValidationError => {
	return new ValidationError(message, details);
};

/**
 * Creates a mock InternalServerError instance
 */
export const createMockInternalServerError = (
	message: string = "Internal Server Error",
	details?: any
): InternalServerError => {
	return new InternalServerError(message, details);
};

/**
 * Creates a mock PrismaClientKnownRequestError instance
 */
export const createMockPrismaKnownRequestError = (
	code: string = "P2002",
	message: string = "Unique constraint violation",
	meta?: any
): Prisma.PrismaClientKnownRequestError => {
	const error = new Prisma.PrismaClientKnownRequestError(message, {
		code,
		clientVersion: "5.0.0",
		meta,
	});
	return error;
};

/**
 * Creates a mock PrismaClientValidationError instance
 */
export const createMockPrismaValidationError = (
	message: string = "Invalid data provided"
): Prisma.PrismaClientValidationError => {
	return new Prisma.PrismaClientValidationError(message, {
		clientVersion: "5.0.0",
	});
};

/**
 * Creates a mock MulterError instance
 */
export const createMockMulterError = (
	code: string = "LIMIT_FILE_SIZE",
	field?: string
): MulterError => {
	const error = new MulterError(code as MulterError["code"]);
	if (field) {
		error.field = field;
	}
	return error;
};

/**
 * Creates a mock JWT JsonWebTokenError instance
 */
export const createMockJsonWebTokenError = (
	message: string = "Invalid token"
): Error => {
	const error = new Error(message);
	error.name = "JsonWebTokenError";
	return error;
};

/**
 * Creates a mock JWT TokenExpiredError instance
 */
export const createMockTokenExpiredError = (
	message: string = "Token expired"
): Error => {
	const error = new Error(message);
	error.name = "TokenExpiredError";
	return error;
};

/**
 * Creates a mock generic Error instance
 */
export const createMockGenericError = (
	message: string = "Generic error"
): Error => {
	return new Error(message);
};

/**
 * Creates a mock Response object for testing
 */
export const createMockResponse = () => {
	const res: any = {
		statusCode: 200,
		headersSent: false,
		status: jest.fn().mockReturnThis(),
		json: jest.fn().mockReturnThis(),
		send: jest.fn().mockReturnThis(),
	};
	return res;
};
