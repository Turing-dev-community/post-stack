import { Response } from "express";
import { handleError } from "./errors";

/**
 * Success response interface
 */
export interface SuccessResponse<T = any> {
	message?: string;
	data?: T;
	[key: string]: any; // Allow additional fields for flexibility
}

/**
 * Response options for handleResponse
 */
export interface ResponseOptions {
	message?: string;
	statusCode?: number;
	data?: any;
	[key: string]: any; // Allow additional fields for flexibility
}

/**
 * Global Response Handler Class
 * Provides a unified interface for handling both positive and negative responses
 *
 * @example
 * const responseHandler = new ResponseHandler(res);
 *
 * // Success response
 * responseHandler.success({ message: 'Post created', post });
 *
 * // Error response
 * responseHandler.error(new NotFoundError('Post not found'));
 */
export class ResponseHandler {
	private res: Response;

	constructor(res: Response) {
		this.res = res;
	}

	/**
	 * Handle positive/success responses
	 * @param options - Response options including message, statusCode, and data
	 */
	success(options: ResponseOptions): void {
		handleResponse(this.res, options);
	}

	/**
	 * Handle negative/error responses
	 * Utilizes the handleError function from errors.ts
	 * @param error - Error instance (AppError, Error, or unknown)
	 */
	error(error: unknown): void {
		handleError(error, this.res);
	}

	/**
	 * Convenience method for 200 OK responses
	 */
	ok(options: Omit<ResponseOptions, "statusCode">): void {
		this.success({ ...options, statusCode: 200 });
	}

	/**
	 * Convenience method for 201 Created responses
	 */
	created(options: Omit<ResponseOptions, "statusCode">): void {
		this.success({ ...options, statusCode: 201 });
	}

	/**
	 * Convenience method for 204 No Content responses
	 */
	noContent(): void {
		responseHelpers.noContent(this.res);
	}
}

/**
 * Formats success response for client
 */
export const formatSuccessResponse = <T = any>(
	options: ResponseOptions
): SuccessResponse<T> => {
	const { message, data, ...rest } = options;
	const response: SuccessResponse<T> = {};

	if (message) {
		response.message = message;
	}

	if (data !== undefined) {
		response.data = data;
	}

	// Add any additional fields
	Object.assign(response, rest);

	return response;
};

/**
 * Sends success response to client
 * This function provides a consistent way to send positive responses
 *
 * @param res - Express Response object
 * @param options - Response options including message, statusCode, and data
 * @returns void
 *
 * @example
 * // Simple success response
 * handleResponse(res, { message: 'Operation successful' });
 *
 * @example
 * // Success with data
 * handleResponse(res, {
 *   message: 'Post created successfully',
 *   data: post,
 *   statusCode: 201
 * });
 *
 * @example
 * // Success with custom fields
 * handleResponse(res, {
 *   message: 'Posts retrieved',
 *   posts: postsArray,
 *   count: postsArray.length,
 *   statusCode: 200
 * });
 */
export const handleResponse = (
	res: Response,
	options: ResponseOptions
): void => {
	// If headers already sent, don't send response
	if (res.headersSent) {
		return;
	}

	const { statusCode = 200, ...responseOptions } = options;
	const response = formatSuccessResponse(responseOptions);

	res.status(statusCode).json(response);
};

/**
 * Convenience methods for common HTTP status codes
 */
export const responseHelpers = {
	/**
	 * Send 200 OK response
	 */
	ok: (res: Response, options: Omit<ResponseOptions, "statusCode">) => {
		handleResponse(res, { ...options, statusCode: 200 });
	},

	/**
	 * Send 201 Created response
	 */
	created: (res: Response, options: Omit<ResponseOptions, "statusCode">) => {
		handleResponse(res, { ...options, statusCode: 201 });
	},

	/**
	 * Send 204 No Content response
	 */
	noContent: (res: Response) => {
		if (res.headersSent) {
			return;
		}
		res.status(204).send();
	},
};
