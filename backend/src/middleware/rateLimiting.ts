import { Request, Response, NextFunction } from 'express';
import RateLimitingService from '../services/RateLimitingService';
import { AuthenticatedRequest } from './auth';
import { APIKeyRequest } from './apiKeyAuth';

/**
 * Rate Limiting Middleware
 * Integrates the RateLimitingService with Express routes
 */

// Generic rate limiter for public routes
export const generalRateLimit = RateLimitingService.createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyGenerator: (req: Request) => req.ip || 'unknown'
});

// Rate limiter for authentication routes
export const authRateLimit = RateLimitingService.createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Strict limit for auth attempts
  keyGenerator: (req: Request) => `auth:${req.ip}:${req.body?.email || 'unknown'}`
});

// Rate limiter for form submissions
export const submissionRateLimit = RateLimitingService.createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req: Request) => `submission:${req.ip}:${req.params.formId || 'unknown'}`
});

// Rate limiter for API endpoints (authenticated users)
export const apiRateLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?._id?.toString();
  const plan = req.user?.subscription?.plan || 'free';
  
  // Different limits based on subscription plan
  const planLimits = {
    free: { windowMs: 60 * 60 * 1000, maxRequests: 100 }, // 100/hour
    starter: { windowMs: 60 * 60 * 1000, maxRequests: 500 }, // 500/hour
    professional: { windowMs: 60 * 60 * 1000, maxRequests: 2000 }, // 2000/hour
    enterprise: { windowMs: 60 * 60 * 1000, maxRequests: 10000 } // 10000/hour
  };
  
  const limits = planLimits[plan as keyof typeof planLimits] || planLimits.free;
  
  const rateLimiter = RateLimitingService.createRateLimiter({
    ...limits,
    keyGenerator: () => `api:user:${userId}`
  });
  
  return rateLimiter(req, res, next);
};

// Rate limiter for API key requests
export const apiKeyRateLimit = (req: APIKeyRequest, res: Response, next: NextFunction) => {
  const apiKey = req.apiKey;
  
  if (!apiKey || !apiKey.rateLimit) {
    return next();
  }
  
  const rateLimit = apiKey.rateLimit;
  const keyId = apiKey.id;
  
  // Apply API key specific rate limits
  const rateLimiter = RateLimitingService.createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: rateLimit.requestsPerMinute,
    keyGenerator: () => `apikey:${keyId}:minute`
  });
  
  return rateLimiter(req, res, next);
};

// Rate limiter for export operations
export const exportRateLimit = RateLimitingService.createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limited exports per hour
  keyGenerator: (req: AuthenticatedRequest) => `export:${req.user?._id?.toString() || req.ip}`
});

// Rate limiter for file uploads
export const uploadRateLimit = RateLimitingService.createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  keyGenerator: (req: AuthenticatedRequest) => `upload:${req.user?._id?.toString() || req.ip}`
});

// Rate limiter for webhook deliveries
export const webhookRateLimit = RateLimitingService.createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 1 per second average
  keyGenerator: (req: Request) => `webhook:${req.params.webhookId || req.ip}`
});

// Rate limiter for password reset requests
export const passwordResetRateLimit = RateLimitingService.createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Very restrictive
  keyGenerator: (req: Request) => `password_reset:${req.body?.email || req.ip}`
});

// Rate limiter for GDPR requests
export const gdprRateLimit = RateLimitingService.createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // Limited GDPR requests per day
  keyGenerator: (req: Request) => `gdpr:${req.body?.email || req.ip}`
});

// Create custom rate limiter with specific options
export const createCustomRateLimit = (options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}) => {
  return RateLimitingService.createRateLimiter({
    keyGenerator: (req: Request) => req.ip || 'unknown',
    ...options
  });
};

// Rate limiting configuration for different route groups
export const rateLimitConfig = {
  auth: authRateLimit,
  api: apiRateLimit,
  apiKey: apiKeyRateLimit,
  submission: submissionRateLimit,
  export: exportRateLimit,
  upload: uploadRateLimit,
  webhook: webhookRateLimit,
  passwordReset: passwordResetRateLimit,
  gdpr: gdprRateLimit,
  general: generalRateLimit
};

export default rateLimitConfig;