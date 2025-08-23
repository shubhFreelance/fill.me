import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

import connectDB from './config/database';
import TemplateService from './services/TemplateService';
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
import errorHandler from './middleware/errorHandler';
import { EnvironmentConfig } from './types';

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '3001', 10);

// Connect to MongoDB
connectDB();

// Seed predefined templates
setTimeout(async () => {
  try {
    await TemplateService.seedPredefinedTemplates();
  } catch (error) {
    console.error('Template seeding error:', error);
  }
}, 2000);

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

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

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
    
    if (process.env.NODE_ENV === 'development') {
      // In development, allow any localhost origin
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

// Logging middleware
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
});

export default app;