import { prisma } from './setup';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';



describe('Image Routes', () => {
  const baseUrl = `http://localhost:${process.env.PORT}/api`;
  let authToken: string;
  let userId: string;
  const uploadsDir = path.join(process.cwd(), 'uploads');

  beforeEach(async () => {

    const hashedPassword = await bcrypt.hash('Password123', 12);
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword,
      },
    });
    userId = user.id;
    authToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);
  });

  afterEach(async () => {

    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      files.forEach((file) => {
        const filePath = path.join(uploadsDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
  });

  describe('POST /api/images/upload', () => {
    it('should upload an image successfully when authenticated', async () => {

      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const formData = new FormData();
      const blob = new Blob([pngBuffer], { type: 'image/png' });
      formData.append('image', blob, 'test.png');

      const response = await fetch(`${baseUrl}/images/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      const data: any = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('message', 'Image uploaded successfully');
      expect(data).toHaveProperty('path');
      expect(data).toHaveProperty('filename');
      expect(data.path).toMatch(/^\/api\/images\/.+/);
      expect(data.filename).toBeTruthy();


      const filePath = path.join(uploadsDir, data.filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should reject upload when not authenticated', async () => {
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const formData = new FormData();
      const blob = new Blob([pngBuffer], { type: 'image/png' });
      formData.append('image', blob, 'test.png');

      const response = await fetch(`${baseUrl}/images/upload`, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(401);
      const data: any = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should reject non-image files', async () => {
      const textBuffer = Buffer.from('This is not an image', 'utf-8');

      const formData = new FormData();
      const blob = new Blob([textBuffer], { type: 'text/plain' });
      formData.append('image', blob, 'test.txt');

      const response = await fetch(`${baseUrl}/images/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      expect(response.status).toBe(400);
      const data: any = await response.json();
      expect(data).toHaveProperty('error', 'Invalid file type');
      expect(data.message).toContain('Only JPEG, PNG, GIF, and WebP images');
    });

    it('should reject upload when no file is provided', async () => {
      const response = await fetch(`${baseUrl}/images/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(400);
      const data: any = await response.json();
      expect(data).toHaveProperty('error', 'No file uploaded');
    });
  });

  describe('GET /api/images/:filename', () => {
    it('should fetch an uploaded image publicly without authentication', async () => {

      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const formData = new FormData();
      const blob = new Blob([pngBuffer], { type: 'image/png' });
      formData.append('image', blob, 'test.png');

      const uploadResponse = await fetch(`${baseUrl}/images/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      const uploadData: any = await uploadResponse.json();
      const filename = uploadData.filename;


      const fetchResponse = await fetch(`${baseUrl}/images/${filename}`);

      expect(fetchResponse.status).toBe(200);
      expect(fetchResponse.headers.get('content-type')).toContain('image/');

      const imageBuffer = await fetchResponse.arrayBuffer();
      expect(imageBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent image', async () => {
      const response = await fetch(`${baseUrl}/images/non-existent-image-12345.png`);

      expect(response.status).toBe(404);
      const data: any = await response.json();
      expect(data).toHaveProperty('error', 'Image not found');
    });

    it('should prevent directory traversal attacks', async () => {
      const response = await fetch(`${baseUrl}/images/../../../../etc/passwd`);

      expect(response.status).toBe(404);
      const data: any = await response.json();
      expect(data).toHaveProperty('error', 'Route not found');
    });
  });
});

