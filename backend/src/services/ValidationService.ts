import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult, ValidationChain } from 'express-validator';
import validator from 'validator';
// Note: DOMPurify will be used on client-side, server-side sanitization uses validator.escape

/**
 * Enhanced Validation Service
 * Provides comprehensive input validation, sanitization, and security checks
 */
export class ValidationService {

  /**
   * Create comprehensive validation middleware
   * @param validations - Array of validation chains
   * @param options - Validation options
   * @returns Express middleware function
   */
  static createValidator(validations: ValidationChain[], options: IValidationOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Run all validations
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
          const formattedErrors = this.formatValidationErrors(errors.array());
          
          res.status(options.statusCode || 400).json({
            success: false,
            error: 'Validation failed',
            message: options.message || 'The request contains invalid data',
            errors: formattedErrors,
            errorCount: formattedErrors.length
          });
          return;
        }

        // Apply sanitization
        if (options.sanitize !== false) {
          this.sanitizeRequest(req);
        }

        // Apply security checks
        if (options.securityChecks !== false) {
          const securityResult = this.performSecurityChecks(req);
          if (!securityResult.passed) {
            res.status(403).json({
              success: false,
              error: 'Security check failed',
              message: securityResult.message,
              issues: securityResult.issues
            });
            return;
          }
        }

        next();
      } catch (error) {
        console.error('Validation middleware error:', error);
        res.status(500).json({
          success: false,
          error: 'Validation error',
          message: 'An error occurred during validation'
        });
      }
    };
  }

  /**
   * Common validation chains for different data types
   */
  static get commonValidations() {
    return {
      // Email validation
      email: body('email')
        .isEmail()
        .withMessage('Must be a valid email address')
        .normalizeEmail()
        .isLength({ max: 255 })
        .withMessage('Email cannot exceed 255 characters'),

      // Password validation
      password: body('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be between 8 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

      // Name validation
      name: body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s\-\'\.]+$/)
        .withMessage('Name can only contain letters, spaces, hyphens, apostrophes, and periods'),

      // Phone validation
      phone: body('phone')
        .optional()
        .isMobilePhone('any')
        .withMessage('Must be a valid phone number'),

      // URL validation
      url: body('url')
        .optional()
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Must be a valid URL with http or https protocol')
        .isLength({ max: 2048 })
        .withMessage('URL cannot exceed 2048 characters'),

      // MongoDB ObjectId validation
      mongoId: param('id')
        .isMongoId()
        .withMessage('Must be a valid MongoDB ObjectId'),

      // Form title validation
      formTitle: body('title')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Form title must be between 1 and 200 characters')
        .matches(/^[^<>\"'&]*$/)
        .withMessage('Form title contains invalid characters'),

      // Form description validation
      formDescription: body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Form description cannot exceed 1000 characters'),

      // Pagination validation
      pagination: [
        query('page')
          .optional()
          .isInt({ min: 1, max: 10000 })
          .withMessage('Page must be a positive integer between 1 and 10000'),
        query('limit')
          .optional()
          .isInt({ min: 1, max: 100 })
          .withMessage('Limit must be between 1 and 100'),
        query('sort')
          .optional()
          .isIn(['createdAt', 'updatedAt', 'title', 'submissions', 'views'])
          .withMessage('Invalid sort field'),
        query('order')
          .optional()
          .isIn(['asc', 'desc'])
          .withMessage('Order must be asc or desc')
      ],

      // Date range validation
      dateRange: [
        query('startDate')
          .optional()
          .isISO8601()
          .withMessage('Start date must be in ISO 8601 format'),
        query('endDate')
          .optional()
          .isISO8601()
          .withMessage('End date must be in ISO 8601 format')
          .custom((endDate, { req }) => {
            if (req.query && req.query.startDate && endDate) {
              const start = new Date(req.query.startDate as string);
              const end = new Date(endDate);
              if (end <= start) {
                throw new Error('End date must be after start date');
              }
            }
            return true;
          })
      ],

      // File upload validation
      fileUpload: body('file')
        .custom((value, { req }) => {
          if (!req.file && !req.files) {
            throw new Error('File is required');
          }
          return true;
        }),

      // Array validation
      array: (fieldName: string, maxLength: number = 100) => 
        body(fieldName)
          .isArray({ max: maxLength })
          .withMessage(`${fieldName} must be an array with maximum ${maxLength} items`),

      // JSON validation
      json: (fieldName: string) =>
        body(fieldName)
          .custom((value) => {
            try {
              if (typeof value === 'string') {
                JSON.parse(value);
              }
              return true;
            } catch {
              throw new Error(`${fieldName} must be valid JSON`);
            }
          }),

      // HTML content validation
      htmlContent: (fieldName: string) =>
        body(fieldName)
          .custom((value) => {
            if (typeof value !== 'string') {
              throw new Error(`${fieldName} must be a string`);
            }
            
            // Check for dangerous HTML patterns
            const dangerousPatterns = [
              /<script/i,
              /javascript:/i,
              /on\w+\s*=/i,
              /<iframe/i,
              /<object/i,
              /<embed/i,
              /<form/i
            ];
            
            for (const pattern of dangerousPatterns) {
              if (pattern.test(value)) {
                throw new Error(`${fieldName} contains potentially dangerous HTML`);
              }
            }
            
            return true;
          })
    };
  }

  /**
   * Sanitize request data
   * @param req - Express request object
   */
  private static sanitizeRequest(req: Request): void {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = this.sanitizeObject(req.query);
    }

    // Sanitize params
    if (req.params && typeof req.params === 'object') {
      req.params = this.sanitizeObject(req.params);
    }
  }

  /**
   * Sanitize an object recursively
   * @param obj - Object to sanitize
   * @returns Sanitized object
   */
  private static sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip keys that look like MongoDB injection attempts
        if (key.startsWith('$') || key.includes('.')) {
          continue;
        }
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    return obj;
  }

  /**
   * Sanitize a string
   * @param str - String to sanitize
   * @returns Sanitized string
   */
  private static sanitizeString(str: string): string {
    // Trim whitespace
    str = str.trim();

    // Remove null bytes
    str = str.replace(/\0/g, '');

    // HTML encode special characters for non-HTML fields
    str = validator.escape(str);

    // Additional sanitization for specific patterns
    str = str.replace(/javascript:/gi, '');
    str = str.replace(/on\w+\s*=/gi, '');
    str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    return str;
  }

  /**
   * Perform security checks on request
   * @param req - Express request object
   * @returns Security check result
   */
  private static performSecurityChecks(req: Request): ISecurityCheckResult {
    const issues: string[] = [];

    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b)/i,
      /(UNION\s+SELECT)/i,
      /(\'\s*OR\s*\'\s*=\s*\')/i,
      /(\'\s*;\s*DROP\s+TABLE)/i
    ];

    const requestContent = JSON.stringify(req.body) + JSON.stringify(req.query);
    
    for (const pattern of sqlPatterns) {
      if (pattern.test(requestContent)) {
        issues.push('Potential SQL injection detected');
        break;
      }
    }

    // Check for NoSQL injection patterns
    const noSqlPatterns = [
      /\$where/i,
      /\$ne/i,
      /\$gt/i,
      /\$lt/i,
      /\$regex/i,
      /\$or/i,
      /\$and/i
    ];

    for (const pattern of noSqlPatterns) {
      if (pattern.test(requestContent)) {
        issues.push('Potential NoSQL injection detected');
        break;
      }
    }

    // Check for XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(requestContent)) {
        issues.push('Potential XSS attack detected');
        break;
      }
    }

    // Check request size
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
      issues.push('Request size exceeds maximum allowed limit');
    }

    // Check for suspicious headers
    const userAgent = req.headers['user-agent'];
    if (userAgent && (userAgent.includes('bot') || userAgent.includes('crawler'))) {
      // This might be legitimate, but flag for monitoring
    }

    return {
      passed: issues.length === 0,
      message: issues.length > 0 ? 'Security issues detected' : 'Security checks passed',
      issues
    };
  }

  /**
   * Format validation errors for consistent response structure
   * @param errors - Array of validation errors
   * @returns Formatted errors
   */
  private static formatValidationErrors(errors: any[]): IFormattedValidationError[] {
    return errors.map(error => ({
      field: error.param || error.path,
      message: error.msg,
      value: error.value,
      location: error.location
    }));
  }

  /**
   * Custom validation for form fields
   * @param fields - Array of form fields to validate
   * @returns Validation chain
   */
  static validateFormFields(fields: any[]): ValidationChain {
    return body('fields')
      .isArray({ min: 1, max: 50 })
      .withMessage('Form must have between 1 and 50 fields')
      .custom((fields) => {
        const allowedTypes = [
          'text', 'textarea', 'email', 'dropdown', 'radio', 'checkbox',
          'date', 'file', 'number', 'phone', 'url', 'rating', 'scale',
          'matrix', 'signature', 'payment', 'address', 'name', 'password',
          'hidden', 'divider', 'heading', 'paragraph', 'image', 'video',
          'audio', 'calendar'
        ];

        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          
          if (!field.id || typeof field.id !== 'string') {
            throw new Error(`Field at index ${i} must have a valid id`);
          }
          
          if (!field.type || !allowedTypes.includes(field.type)) {
            throw new Error(`Field at index ${i} has invalid type: ${field.type}`);
          }
          
          if (!field.label || typeof field.label !== 'string' || field.label.length > 200) {
            throw new Error(`Field at index ${i} must have a valid label (max 200 characters)`);
          }
          
          if (field.required !== undefined && typeof field.required !== 'boolean') {
            throw new Error(`Field at index ${i} required property must be boolean`);
          }
        }

        return true;
      });
  }

  /**
   * Validate API key permissions
   * @param permissions - Permissions object to validate
   * @returns Validation chain
   */
  static validateAPIKeyPermissions(): ValidationChain {
    return body('permissions')
      .optional()
      .custom((permissions) => {
        if (typeof permissions !== 'object' || permissions === null) {
          throw new Error('Permissions must be an object');
        }

        const requiredResources = ['forms', 'responses', 'analytics', 'webhooks', 'users'];
        const requiredActions = ['read', 'create', 'update', 'delete'];

        for (const resource of requiredResources) {
          if (!(resource in permissions)) {
            throw new Error(`Missing permissions for resource: ${resource}`);
          }

          for (const action of requiredActions) {
            if (!(action in permissions[resource]) || typeof permissions[resource][action] !== 'boolean') {
              throw new Error(`Invalid permission for ${resource}.${action}`);
            }
          }
        }

        return true;
      });
  }
}

// Type definitions
export interface IValidationOptions {
  statusCode?: number;
  message?: string;
  sanitize?: boolean;
  securityChecks?: boolean;
}

export interface ISecurityCheckResult {
  passed: boolean;
  message: string;
  issues: string[];
}

export interface IFormattedValidationError {
  field: string;
  message: string;
  value: any;
  location: string;
}

export default ValidationService;