import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { handleError, ValidationError } from "../utils/errors";

export const handleValidationErrors = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		const validationError = new ValidationError(
			"Validation failed",
			errors.array()
		);
		return handleError(validationError, res);
	}
	next();
};

export const asyncHandler = (fn: Function) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch((error) => {
			handleError(error, res);
		});
	};
};

export const errorHandler = (
	error: Error,
	_req: Request,
	res: Response,
	_next: NextFunction
): void => {
	handleError(error, res);
};
