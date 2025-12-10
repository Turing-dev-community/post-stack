import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import postRoutes from './routes/posts';
import commentRoutes from './routes/comments';
import categoryRoutes from './routes/categories';
import userRoutes from './routes/users';
import tagRoutes from './routes/tags';
import imageRoutes from './routes/images';
import reportRoutes from './routes/reports';
import sitemapRoutes from './routes/sitemap';
import notificationRoutes from './routes/notifications';
import { authenticateToken } from './utils/auth';
import { errorHandler } from './middleware/validation';
import globalRateLimit from './middleware/rateLimit';
import { validateCorsOrigins } from './utils/corsValidator';
import requestTimeout from './middleware/timeout';
import bodySizeLimitMiddleware from './middleware/bodySizeLimit';

const app = express();
const PORT = process.env.PORT || 3000;

// Security & CORS
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));

// Rate Limiting
app.use(globalRateLimit);

// Request Timeout
app.use(requestTimeout);
// Body Size Limit Validation (before parsing)
app.use(bodySizeLimitMiddleware);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/posts', commentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/', sitemapRoutes);

// Protected Example
app.use('/api/protected', authenticateToken);

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use(errorHandler);

// ⭐ EXPORT FIRST (so tests can import app)
export default app;

// ⭐ SERVER STARTS ONLY IN NON-TEST ENVIRONMENT
if (process.env.NODE_ENV !== 'test') {
  // Validate CORS origins at startup
  validateCorsOrigins();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
}
