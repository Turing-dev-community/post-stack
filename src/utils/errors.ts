import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', details?: any) {
    super(message, 400, true, details);
    this.name = 'BadRequestError';
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: any) {
    super(message, 401, true, details);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: any) {
    super(message, 403, true, details);
    this.name = 'ForbiddenError';
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(message, 404, true, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', details?: any) {
    super(message, 409, true, details);
    this.name = 'ConflictError';
  }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 400, true, details);
    this.name = 'ValidationError';
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error', details?: any) {
    super(message, 500, false, details);
    this.name = 'InternalServerError';
  }
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
  stack?: string;
}

/**
 * Handles Prisma errors and converts them to AppError
 */
export const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const target = (error.meta?.target as string[]) || [];
      const field = target[0] || 'field';
      return new ConflictError(
        `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        { field, code: error.code }
      );

    case 'P2025':
      // Record not found
      return new NotFoundError('Resource not found', { code: error.code });

    case 'P2003':
      // Foreign key constraint violation
      return new BadRequestError('Invalid reference to related resource', { code: error.code });

    case 'P2014':
      // Required relation violation
      return new BadRequestError('Required relation missing', { code: error.code });

    case 'P2000':
      // Value too long
      return new ValidationError('Value exceeds maximum length', { code: error.code });

    case 'P2001':
      // Record does not exist
      return new NotFoundError('Record does not exist', { code: error.code });

    default:
      return new InternalServerError('Database operation failed', { code: error.code });
  }
};

/**
 * Handles Multer errors and converts them to AppError
 */
export const handleMulterError = (error: MulterError): AppError => {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new BadRequestError('File too large', {
        message: 'Image size must be less than 5MB',
        code: error.code,
      });

    case 'LIMIT_FILE_COUNT':
      return new BadRequestError('Too many files', {
        message: 'Only one file is allowed',
        code: error.code,
      });

    case 'LIMIT_UNEXPECTED_FILE':
      return new BadRequestError('Unexpected file field', {
        message: 'Invalid file field name',
        code: error.code,
      });

    default:
      return new BadRequestError('Upload error', {
        message: error.message,
        code: error.code,
      });
  }
};

/**
 * Formats error response for client
 */
export const formatErrorResponse = (
  error: Error | AppError,
  includeStack: boolean = false
): ErrorResponse => {
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;
  const message = error.message || 'An unexpected error occurred';
  const errorName = isAppError ? error.name : 'Error';

  const response: ErrorResponse = {
    error: errorName,
    message,
  };

  if (isAppError && error.details) {
    response.details = error.details;
  }

  // Only include stack trace in development
  if (includeStack && process.env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }

  return response;
};

/**
 * Sends error response to client
 */
export const sendErrorResponse = (
  res: Response,
  error: Error | AppError,
  includeStack: boolean = false
): void => {
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;
  const response = formatErrorResponse(error, includeStack);

  res.status(statusCode).json(response);
};

/**
 * Main error handler that processes all types of errors
 */
export const handleError = (error: unknown, res: Response): void => {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return;
  }

  // Handle AppError instances
  if (error instanceof AppError) {
    return sendErrorResponse(res, error, true);
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const appError = handlePrismaError(error);
    return sendErrorResponse(res, appError, true);
  }

  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    const validationError = new ValidationError('Invalid data provided', {
      message: error.message,
    });
    return sendErrorResponse(res, validationError, true);
  }

  // Handle Multer errors
  if (error instanceof MulterError) {
    const multerError = handleMulterError(error);
    return sendErrorResponse(res, multerError, true);
  }

  // Handle JWT errors
  if (error instanceof Error && error.name === 'JsonWebTokenError') {
    const jwtError = new UnauthorizedError('Invalid token');
    return sendErrorResponse(res, jwtError, true);
  }

  if (error instanceof Error && error.name === 'TokenExpiredError') {
    const jwtError = new UnauthorizedError('Token expired');
    return sendErrorResponse(res, jwtError, true);
  }

  // Handle generic Error instances
  if (error instanceof Error) {
    const genericError = new InternalServerError(
      process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    );
    return sendErrorResponse(res, genericError, true);
  }

  // Handle unknown error types
  const unknownError = new InternalServerError('An unexpected error occurred');
  return sendErrorResponse(res, unknownError, true);
};

/**
 * Async error handler wrapper
 * Use this to wrap async route handlers
 */
export const asyncErrorHandler = (
  fn: (req: any, res: Response, next?: any) => Promise<any>
) => {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      handleError(error, res);
    });
  };
};

