import request from 'supertest';
import express, { Express } from 'express';
import { bodySizeLimitMiddleware } from '../middleware/bodySizeLimit';
import { DEFAULT_MAX_BODY_SIZE, formatBytes } from '../constants/bodySize';

describe('Body Size Limit Middleware', () => {
  let app: Express;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(bodySizeLimitMiddleware);
    app.use(express.json());
    app.post('/test', (req, res) => {
      res.json({ success: true, body: req.body });
    });
  });

  describe('Content-Length validation', () => {
    it('should allow requests within the size limit', async () => {
      const payload = { message: 'Hello, World!' };

      const res = await request(app)
        .post('/test')
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.body).toEqual(payload);
    });

    it('should return 413 for requests exceeding the size limit', async () => {
      const res = await request(app)
        .post('/test')
        .set('Content-Length', String(DEFAULT_MAX_BODY_SIZE + 1))
        .send('x')
        .expect(413);

      expect(res.body.error).toBe('Payload Too Large');
      expect(res.body.message).toContain('exceeds the maximum allowed size');
      expect(res.body.maxSize).toBe(DEFAULT_MAX_BODY_SIZE);
    });

    it('should include readable size information in error response', async () => {
      const oversizedLength = DEFAULT_MAX_BODY_SIZE + 1000;

      const res = await request(app)
        .post('/test')
        .set('Content-Length', String(oversizedLength))
        .send('x')
        .expect(413);

      expect(res.body.maxSizeReadable).toBeDefined();
      expect(res.body.receivedSize).toBe(oversizedLength);
    });

    it('should allow requests without Content-Length header', async () => {
      // GET requests typically don't have Content-Length
      app.get('/test-get', (req, res) => {
        res.json({ success: true });
      });

      const res = await request(app)
        .get('/test-get')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should handle invalid Content-Length gracefully', async () => {
      // Express returns 400 Bad Request for invalid Content-Length headers
      // Our middleware passes it through, then Express handles it
      const res = await request(app)
        .post('/test')
        .set('Content-Length', 'invalid')
        .send({ test: true })
        .expect(400);

      // Express rejects invalid Content-Length before our handler runs
      expect(res.status).toBe(400);
    });

    it('should allow small requests without issues', async () => {
      // Test that normal-sized requests pass through fine
      const payload = { data: 'a'.repeat(1000) }; // 1KB payload
      
      const res = await request(app)
        .post('/test')
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should reject requests just over the size limit', async () => {
      const res = await request(app)
        .post('/test')
        .set('Content-Length', String(DEFAULT_MAX_BODY_SIZE + 1))
        .send('x')
        .expect(413);

      expect(res.body.error).toBe('Payload Too Large');
    });
  });

  describe('formatBytes utility', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle decimal values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });
  });

  describe('Different HTTP methods', () => {
    beforeEach(() => {
      app.put('/test', (req, res) => {
        res.json({ success: true, body: req.body });
      });
      app.patch('/test', (req, res) => {
        res.json({ success: true, body: req.body });
      });
    });

    it('should validate PUT requests', async () => {
      const res = await request(app)
        .put('/test')
        .set('Content-Length', String(DEFAULT_MAX_BODY_SIZE + 1))
        .send('x')
        .expect(413);

      expect(res.body.error).toBe('Payload Too Large');
    });

    it('should validate PATCH requests', async () => {
      const res = await request(app)
        .patch('/test')
        .set('Content-Length', String(DEFAULT_MAX_BODY_SIZE + 1))
        .send('x')
        .expect(413);

      expect(res.body.error).toBe('Payload Too Large');
    });
  });
});

