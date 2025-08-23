import { Request, Response, NextFunction } from 'express';
import { APIKeyRequest } from '../middleware/apiKeyAuth';

/**
 * Advanced Rate Limiting Service
 * Provides flexible rate limiting with multiple strategies and storage backends
 */
export class RateLimitingService {
  private static rateLimitStore: Map<string, IRateLimitRecord> = new Map();
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize rate limiting service
   */
  static initialize(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Create rate limiter middleware
   * @param options - Rate limiting options
   * @returns Express middleware function
   */
  static createRateLimiter(options: IRateLimitOptions) {
    return async (req: Request | APIKeyRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const identifier = this.getIdentifier(req, options.keyGenerator);
        const key = `${options.windowMs}_${identifier}`;
        
        const result = await this.checkRateLimit(key, options);
        
        // Set rate limit headers
        this.setRateLimitHeaders(res, result, options);
        
        if (result.isExceeded) {
          const retryAfter = Math.ceil(result.resetTime / 1000);
          res.setHeader('Retry-After', retryAfter);
          
          // Call onLimitReached callback if provided
          if (options.onLimitReached) {
            (options.onLimitReached as any)(req, res, next);
            return;
          }
          
          res.status(options.statusCode || 429).json({
            success: false,
            error: 'Rate limit exceeded',
            message: options.message || 'Too many requests, please try again later',
            retryAfter,
            limit: options.max,
            windowMs: options.windowMs
          });
          return;
        }
        
        // Call onRequest callback if provided
        if (options.onRequest) {
          (options.onRequest as any)(req, res, result);
        }
        
        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        next(); // Continue on error to avoid blocking requests
      }
    };
  }

  /**
   * Create API key specific rate limiter
   * @param req - Request with API key information
   * @returns Rate limiting result
   */
  static async checkAPIKeyRateLimit(req: APIKeyRequest): Promise<IRateLimitResult> {
    if (!req.apiKey || !req.apiKey.rateLimit) {
      return { isExceeded: false, current: 0, limit: Infinity, resetTime: 0 };
    }

    const rateLimit = req.apiKey.rateLimit;
    const identifier = `apikey_${req.apiKey.id}`;
    
    // Check all rate limit windows
    const results = await Promise.all([
      this.checkRateLimit(`${60000}_${identifier}`, {
        windowMs: 60 * 1000,
        max: rateLimit.requestsPerMinute
      }),
      this.checkRateLimit(`${3600000}_${identifier}`, {
        windowMs: 60 * 60 * 1000,
        max: rateLimit.requestsPerHour
      }),
      this.checkRateLimit(`${86400000}_${identifier}`, {
        windowMs: 24 * 60 * 60 * 1000,
        max: rateLimit.requestsPerDay
      })
    ]);

    // Return the most restrictive result
    const exceeded = results.find(result => result.isExceeded);
    return exceeded || results[0];
  }

  /**
   * Create distributed rate limiter (for production with Redis)
   * @param options - Rate limiting options with Redis configuration
   * @returns Express middleware function
   */
  static createDistributedRateLimiter(options: IDistributedRateLimitOptions) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // This would integrate with Redis for distributed rate limiting
        // For now, fall back to in-memory implementation
        console.log('Distributed rate limiting not yet implemented, using in-memory fallback');
        
        const basicOptions: IRateLimitOptions = {
          windowMs: options.windowMs,
          max: options.max,
          keyGenerator: options.keyGenerator,
          skipSuccessfulRequests: options.skipSuccessfulRequests,
          skipFailedRequests: options.skipFailedRequests
        };
        
        return this.createRateLimiter(basicOptions)(req, res, next);
      } catch (error) {
        console.error('Distributed rate limiting error:', error);
        next();
      }
    };
  }

  /**
   * Create sliding window rate limiter
   * @param options - Sliding window options
   * @returns Express middleware function
   */
  static createSlidingWindowLimiter(options: ISlidingWindowOptions) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const identifier = this.getIdentifier(req, options.keyGenerator);
        const key = `sliding_${options.windowMs}_${identifier}`;
        
        const result = await this.checkSlidingWindow(key, options);
        
        this.setRateLimitHeaders(res, result, options);
        
        if (result.isExceeded) {
          res.status(options.statusCode || 429).json({
            success: false,
            error: 'Rate limit exceeded',
            message: 'Too many requests in sliding window',
            limit: options.max,
            current: result.current,
            windowMs: options.windowMs
          });
          return;
        }
        
        next();
      } catch (error) {
        console.error('Sliding window rate limiting error:', error);
        next();
      }
    };
  }

  /**
   * Check rate limit for a specific key
   * @param key - Rate limit key
   * @param options - Rate limit options
   * @returns Rate limit result
   */
  private static async checkRateLimit(key: string, options: Partial<IRateLimitOptions>): Promise<IRateLimitResult> {
    const now = Date.now();
    const windowMs = options.windowMs || 60000;
    const max = options.max || 100;
    
    let record = this.rateLimitStore.get(key);
    
    if (!record || now >= record.resetTime) {
      // Reset window
      record = {
        count: 0,
        resetTime: now + windowMs,
        firstRequest: now
      };
    }
    
    record.count++;
    this.rateLimitStore.set(key, record);
    
    return {
      isExceeded: record.count > max,
      current: record.count,
      limit: max,
      resetTime: record.resetTime - now,
      remaining: Math.max(0, max - record.count)
    };
  }

  /**
   * Check sliding window rate limit
   * @param key - Rate limit key
   * @param options - Sliding window options
   * @returns Rate limit result
   */
  private static async checkSlidingWindow(key: string, options: ISlidingWindowOptions): Promise<IRateLimitResult> {
    const now = Date.now();
    const windowMs = options.windowMs;
    const max = options.max;
    
    // Get or create sliding window record
    const slidingKey = `${key}_sliding`;
    let timestamps: number[] = JSON.parse(this.rateLimitStore.get(slidingKey)?.count.toString() || '[]');
    
    // Remove timestamps outside the window
    timestamps = timestamps.filter(timestamp => now - timestamp < windowMs);
    
    // Add current timestamp
    timestamps.push(now);
    
    // Store updated timestamps
    this.rateLimitStore.set(slidingKey, {
      count: JSON.parse(JSON.stringify(timestamps)) as any,
      resetTime: now + windowMs,
      firstRequest: timestamps[0] || now
    });
    
    const count = timestamps.length;
    
    return {
      isExceeded: count > max,
      current: count,
      limit: max,
      resetTime: Math.max(0, windowMs - (now - (timestamps[0] || now))),
      remaining: Math.max(0, max - count)
    };
  }

  /**
   * Get identifier for rate limiting
   * @param req - Express request
   * @param keyGenerator - Custom key generator function
   * @returns Rate limit identifier
   */
  private static getIdentifier(req: Request | APIKeyRequest, keyGenerator?: (req: any) => string): string {
    if (keyGenerator) {
      return keyGenerator(req);
    }
    
    // Check if it's an API key request
    if ('apiKey' in req && req.apiKey) {
      const apiKeyData = req.apiKey as any;
      if (apiKeyData && apiKeyData.id) {
        return `apikey_${apiKeyData.id}`;
      }
    }
    
    // Default to IP address
    return req.ip || (req.connection as any)?.remoteAddress || 'unknown';
  }

  /**
   * Set rate limit headers
   * @param res - Express response
   * @param result - Rate limit result
   * @param options - Rate limit options
   */
  private static setRateLimitHeaders(res: Response, result: IRateLimitResult, options: any): void {
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining || 0);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.resetTime).toISOString());
    
    if (options.windowMs) {
      res.setHeader('X-RateLimit-Window', Math.ceil(options.windowMs / 1000));
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private static cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, record] of this.rateLimitStore.entries()) {
      if (now >= record.resetTime) {
        this.rateLimitStore.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired rate limit entries`);
    }
  }

  /**
   * Reset rate limit for a specific identifier
   * @param identifier - Rate limit identifier
   * @param windowMs - Window size in milliseconds
   */
  static resetRateLimit(identifier: string, windowMs: number = 60000): void {
    const key = `${windowMs}_${identifier}`;
    this.rateLimitStore.delete(key);
  }

  /**
   * Get current rate limit status
   * @param identifier - Rate limit identifier
   * @param windowMs - Window size in milliseconds
   * @returns Current rate limit status
   */
  static getRateLimitStatus(identifier: string, windowMs: number = 60000): IRateLimitRecord | null {
    const key = `${windowMs}_${identifier}`;
    return this.rateLimitStore.get(key) || null;
  }

  /**
   * Shutdown rate limiting service
   */
  static shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.rateLimitStore.clear();
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const RateLimiters = {
  // General API rate limiting
  general: RateLimitingService.createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  }),

  // Strict rate limiting for sensitive endpoints
  strict: RateLimitingService.createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    message: 'Rate limit exceeded for sensitive operation',
    standardHeaders: true,
    legacyHeaders: false
  }),

  // Authentication rate limiting
  auth: RateLimitingService.createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth attempts per windowMs
    message: 'Too many authentication attempts, please try again later',
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false
  }),

  // File upload rate limiting
  upload: RateLimitingService.createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // limit each IP to 50 uploads per hour
    message: 'Upload rate limit exceeded',
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise IP
      return (req as any).user?.id || req.ip || 'anonymous';
    },
    standardHeaders: true,
    legacyHeaders: false
  }),

  // API key specific rate limiting
  apiKey: async (req: APIKeyRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      return next();
    }

    const result = await RateLimitingService.checkAPIKeyRateLimit(req);
    
    // Set API key specific headers
    res.setHeader('X-API-RateLimit-Limit-Minute', req.apiKey.rateLimit.requestsPerMinute);
    res.setHeader('X-API-RateLimit-Limit-Hour', req.apiKey.rateLimit.requestsPerHour);
    res.setHeader('X-API-RateLimit-Limit-Day', req.apiKey.rateLimit.requestsPerDay);
    
    if (result.isExceeded) {
      res.status(429).json({
        success: false,
        error: 'API key rate limit exceeded',
        message: 'Your API key has exceeded its rate limit',
        rateLimit: req.apiKey.rateLimit,
        retryAfter: Math.ceil(result.resetTime / 1000)
      });
      return;
    }
    
    next();
  }
};

// Type definitions
export interface IRateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: Request, res: Response, next: NextFunction) => void;
  onRequest?: (req: Request, res: Response, result: IRateLimitResult) => void;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface IDistributedRateLimitOptions extends IRateLimitOptions {
  redisUrl?: string;
  keyPrefix?: string;
  enableCluster?: boolean;
}

export interface ISlidingWindowOptions {
  windowMs: number;
  max: number;
  statusCode?: number;
  keyGenerator?: (req: Request) => string;
}

export interface IRateLimitResult {
  isExceeded: boolean;
  current: number;
  limit: number;
  resetTime: number;
  remaining?: number;
}

export interface IRateLimitRecord {
  count: number;
  resetTime: number;
  firstRequest: number;
}

// Initialize rate limiting service
RateLimitingService.initialize();

export default RateLimitingService;