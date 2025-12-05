import { Request, Response, NextFunction } from 'express';
import { REQUEST_TIMEOUT_MS } from '../constants/timeout';

const requestTimeout = (req: Request, res: Response, next: NextFunction) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        error: 'Request Timeout',
        message: 'The request took too long to process. Please try again.',
      });
    }
  }, REQUEST_TIMEOUT_MS);

  res.on('finish', () => {
    clearTimeout(timer);
  });

  res.on('close', () => {
    clearTimeout(timer);
  });

  next();
};

export default requestTimeout;
