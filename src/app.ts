import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Import routes
import authRoutes from './routes/auth.routes';
import newsRoutes from './routes/news.routes';
import userRoutes from './routes/user.routes';
import roleRoutes from './routes/role.routes';
import announcementRoutes from './routes/announcement.routes';
import eventRoutes from './routes/event.routes';
import organizationRoutes from './routes/organization.routes';
import publicAnnouncementRoutes from './routes/public-announcement.routes';
import adminRoutes from './routes/admin.routes';
import uploadRoutes from './routes/upload.routes';
import faqRoutes from './routes/faq.routes';
import auditRoutes from './routes/audit.routes';
import studentAdminRoutes from './routes/student-admin.routes';
import academicRoutes from './routes/academic.routes';
import studentAuthRoutes from './routes/student-auth.routes';
import studentRoutes from './routes/student.routes';
import adminEventRoutes from './routes/admin-event.routes';

// Import middleware
import { errorHandler, notFound } from './middleware/errorHandler';
import { createGeneralApiRateLimiter } from './middleware/rateLimiters';

// Import utilities
import logger from './utils/logger';
import connectDB from './config/database';
import { validateEnv } from './config/validateEnv';

// Create Express app
const app: Application = express();

validateEnv();

// Connect to database
connectDB();

// Security middleware
app.use(helmet());

const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  ...configuredOrigins,
]);

const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';
const vercelPreviewPattern = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/i;

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    if (allowVercelPreviews && vercelPreviewPattern.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
app.use('/api', createGeneralApiRateLimiter());

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/public/announcements', publicAnnouncementRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/students', studentAdminRoutes);
app.use('/api/admin/academic', academicRoutes);
app.use('/api/admin/events', adminEventRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/student/auth', studentAuthRoutes);
app.use('/api/student', studentRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
