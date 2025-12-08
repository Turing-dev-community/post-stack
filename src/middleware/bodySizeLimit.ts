import { Request, Response, NextFunction } from 'express';
import { MAX_BODY_SIZE, MAX_BODY_SIZE_READABLE } from '../constants/bodySize';

/**
 * Middleware to validate request body size before parsing.
 * Checks the Content-Length header and returns 413 Payload Too Large
 * if the request body exceeds the configured limit.
 *
 * This provides early rejection of oversized requests before
 * Express attempts to parse the body, saving server resources.
 */
export const bodySizeLimitMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentLength = req.headers['content-length'];

  // If no Content-Length header, let Express handle it
  if (!contentLength) {
    return next();
  }

  const bodySize = parseInt(contentLength, 10);

  // Check if Content-Length is a valid number
  if (isNaN(bodySize)) {
    return next();
  }

  // Check if body size exceeds the limit
  if (bodySize > MAX_BODY_SIZE) {
    res.status(413).json({
      error: 'Payload Too Large',
      message: `Request body size (${formatBytesInline(bodySize)}) exceeds the maximum allowed size of ${MAX_BODY_SIZE_READABLE}`,
      maxSize: MAX_BODY_SIZE,
      maxSizeReadable: MAX_BODY_SIZE_READABLE,
      receivedSize: bodySize,
    });
    return;
  }

  next();
};

/**
 * Inline helper to format bytes for error messages
 */
const formatBytesInline = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default bodySizeLimitMiddleware;

