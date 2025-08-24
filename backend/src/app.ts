import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { generalRateLimit } from './middleware/rateLimiting';

// Load environment variables
dotenv.config();

import authRoutes from './routes/auth';
import formRoutes from './routes/forms';
import publicRoutes from './routes/public';
import responseRoutes from './routes/responses';
import templateRoutes from './routes/templates';
import workspaceRoutes from './routes/workspaces';
import integrationRoutes from './routes/integrations';
import analyticsRoutes from './routes/analytics';
import paymentRoutes from './routes/payments';
import conditionalLogicRoutes from './routes/conditionalLogic';
import answerRecallRoutes from './routes/answerRecall';
import calculatorRoutes from './routes/calculator';
import prefillRoutes from './routes/prefill';
import themeRoutes from './routes/themes';
import qrcodeRoutes from './routes/qrcode';
import domainRoutes from './routes/domains';
import typeformImportRoutes from './routes/typeformImport';
import thankYouPageRoutes from './routes/thankYouPages';
import confettiRoutes from './routes/confetti';
import languageRoutes from './routes/languages';
import advancedAnalyticsRoutes from './routes/advancedAnalytics';
import chartRoutes from './routes/charts';
import dateFilterRoutes from './routes/dateFilters';
import partialSubmissionRoutes from './routes/partialSubmissions';
import exportRoutes from './routes/exports';
import gdprRoutes from './routes/gdpr';
import apiKeyRoutes from './routes/apiKeys';
import adminRoutes from './routes/admin';
import formBuilderRoutes from './routes/formBuilder';
import errorHandler from './middleware/errorHandler';

const app: Application = express();

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameSrc: ["'self'", "*"], // Allow iframe embedding
      frameAncestors: ["'self'", "*"], // Allow being embedded
    },
  },
}));

// Enhanced rate limiting with dynamic configuration (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/', generalRateLimit);
}

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins: string[] = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3005', // development port
    ];
    
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      // In development/test, allow any localhost origin
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware (skip in test environment)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve uploaded files
const uploadDir: string = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/conditional-logic', conditionalLogicRoutes);
app.use('/api/answer-recall', answerRecallRoutes);
app.use('/api/calculator', calculatorRoutes);
app.use('/api/prefill', prefillRoutes);
app.use('/api/themes', themeRoutes);
app.use('/api/qrcode', qrcodeRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/typeform', typeformImportRoutes);
app.use('/api/thank-you-pages', thankYouPageRoutes);
app.use('/api/confetti', confettiRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/advanced-analytics', advancedAnalyticsRoutes);
app.use('/api/charts', chartRoutes);
app.use('/api/date-filters', dateFilterRoutes);
app.use('/api/partial-submissions', partialSubmissionRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/form-builder', formBuilderRoutes);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use(errorHandler);

export default app;