import request from 'supertest';
import express, { Request, Response } from 'express';
import requestTimeout from '../middleware/timeout';

describe('Request Timeout Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(requestTimeout);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should allow requests that complete within timeout', async () => {
    app.get('/fast', (req: Request, res: Response) => {
      res.json({ message: 'Success' });
    });

    const response = await request(app).get('/fast');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Success');
  });

  it('should timeout requests that exceed the configured duration', async () => {
    const originalTimeout = process.env.REQUEST_TIMEOUT_MS;
    process.env.REQUEST_TIMEOUT_MS = '100';

    jest.resetModules();
    const { default: shortTimeoutMiddleware } = require('../middleware/timeout');

    const testApp = express();
    testApp.use(shortTimeoutMiddleware);

    testApp.get('/slow', async (req: Request, res: Response) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (!res.headersSent) {
        res.json({ message: 'This should not be sent' });
      }
    });

    const response = await request(testApp).get('/slow');
    expect(response.status).toBe(408);
    expect(response.body.error).toBe('Request Timeout');
    expect(response.body.message).toContain('took too long');

    if (originalTimeout) {
      process.env.REQUEST_TIMEOUT_MS = originalTimeout;
    } else {
      delete process.env.REQUEST_TIMEOUT_MS;
    }
    
    jest.resetModules();
  }, 10000);

  it('should not send timeout response if headers already sent', async () => {
    const originalTimeout = process.env.REQUEST_TIMEOUT_MS;
    process.env.REQUEST_TIMEOUT_MS = '50';

    jest.resetModules();
    const { default: shortTimeoutMiddleware } = require('../middleware/timeout');

    const testApp = express();
    testApp.use(shortTimeoutMiddleware);

    testApp.get('/partial', async (req: Request, res: Response) => {
      res.status(200).json({ message: 'Success' });
    });

    const response = await request(testApp).get('/partial');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Success');

    if (originalTimeout) {
      process.env.REQUEST_TIMEOUT_MS = originalTimeout;
    } else {
      delete process.env.REQUEST_TIMEOUT_MS;
    }
    
    jest.resetModules();
  }, 10000);

  it('should use default timeout when REQUEST_TIMEOUT_MS is not set', () => {
    const originalTimeout = process.env.REQUEST_TIMEOUT_MS;
    delete process.env.REQUEST_TIMEOUT_MS;

    jest.resetModules();
    const { REQUEST_TIMEOUT_MS } = require('../constants/timeout');

    expect(REQUEST_TIMEOUT_MS).toBe(30000); 

    if (originalTimeout) {
      process.env.REQUEST_TIMEOUT_MS = originalTimeout;
    }

    jest.resetModules();
  });

  it('should cleanup timeout on response finish', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    app.get('/cleanup', (req: Request, res: Response) => {
      res.json({ message: 'Success' });
    });

    await request(app).get('/cleanup');

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
