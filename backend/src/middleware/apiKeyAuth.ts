import { Request, Response, NextFunction } from 'express';
import APIKeyService from '../services/APIKeyService';
import { IAPIKeyValidation } from '../services/APIKeyService';

// Extend the Request interface to include API key data
export interface APIKeyRequest extends Request {
  apiKeyUser?: {
    id: string;
    email: string;
    name: string;
    plan: string;
  };
  apiKey?: {
    id: string;
    name: string;
    keyType: string;
    permissions: any;
    scopes: string[];
    rateLimit: any;
    restrictions: any;
  };
}

/**
 * API Key Authentication Middleware
 * Validates API keys and adds user/key information to request object
 */
export const apiKeyAuth = async (req: APIKeyRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract API key from different sources
    let apiKey: string | undefined;

    // 1. Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }

    // 2. X-API-Key header
    if (!apiKey && req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key'] as string;
    }

    // 3. Query parameter (less secure, but sometimes necessary)
    if (!apiKey && req.query.api_key) {
      apiKey = req.query.api_key as string;
    }

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key is required',
        message: 'Please provide an API key in the Authorization header, X-API-Key header, or api_key query parameter'
      });
      return;
    }

    // Validate the API key
    const validation: IAPIKeyValidation = await APIKeyService.validateAPIKey(apiKey);

    if (!validation.isValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: validation.error || 'The provided API key is invalid or expired'
      });
      return;
    }

    // Add user and API key information to request
    req.apiKeyUser = validation.user;
    req.apiKey = validation.apiKey;

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: 'An error occurred while validating the API key'
    });
  }
};

/**
 * Permission Check Middleware
 * Validates that the API key has the required permissions for the action
 */
export const requirePermission = (resource: string, action: string) => {
  return (req: APIKeyRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.apiKey || !req.apiKey.permissions) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: 'API key permissions could not be verified'
        });
        return;
      }

      const permissions = req.apiKey.permissions;
      const resourcePermissions = permissions[resource as keyof typeof permissions];

      if (!resourcePermissions || !resourcePermissions[action as keyof typeof resourcePermissions]) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: `API key does not have permission to ${action} ${resource}`
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Permission check error',
        message: 'An error occurred while checking permissions'
      });
    }
  };
};

/**
 * Scope Check Middleware
 * Validates that the API key has the required scopes
 */
export const requireScope = (requiredScopes: string[]) => {
  return (req: APIKeyRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.apiKey || !req.apiKey.scopes) {
        res.status(403).json({
          success: false,
          error: 'Insufficient scopes',
          message: 'API key scopes could not be verified'
        });
        return;
      }

      const hasRequiredScopes = requiredScopes.every(scope => 
        req.apiKey!.scopes.includes(scope)
      );

      if (!hasRequiredScopes) {
        res.status(403).json({
          success: false,
          error: 'Insufficient scopes',
          message: `API key requires scopes: ${requiredScopes.join(', ')}`
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Scope check error:', error);
      res.status(500).json({
        success: false,
        error: 'Scope check error',
        message: 'An error occurred while checking scopes'
      });
    }
  };
};

/**
 * IP Restriction Middleware
 * Validates that the request comes from an allowed IP address
 */
export const checkIPRestrictions = (req: APIKeyRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.apiKey || !req.apiKey.restrictions || !req.apiKey.restrictions.allowedIPs) {
      next();
      return;
    }

    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const allowedIPs = req.apiKey.restrictions.allowedIPs;

    if (!clientIP || !allowedIPs.includes(clientIP)) {
      res.status(403).json({
        success: false,
        error: 'IP address not allowed',
        message: 'Your IP address is not authorized to use this API key'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('IP restriction check error:', error);
    res.status(500).json({
      success: false,
      error: 'IP restriction check error',
      message: 'An error occurred while checking IP restrictions'
    });
  }
};

/**
 * Domain Restriction Middleware
 * Validates that the request comes from an allowed domain (for web requests)
 */
export const checkDomainRestrictions = (req: APIKeyRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.apiKey || !req.apiKey.restrictions || !req.apiKey.restrictions.allowedDomains) {
      next();
      return;
    }

    const origin = req.headers.origin || req.headers.referer;
    const allowedDomains = req.apiKey.restrictions.allowedDomains;

    if (!origin) {
      next();
      return;
    }

    const requestDomain = new URL(origin).hostname;
    const isAllowed = allowedDomains.some(domain => {
      // Support wildcard domains like *.example.com
      if (domain.startsWith('*.')) {
        const wildcardDomain = domain.substring(2);
        return requestDomain.endsWith(wildcardDomain);
      }
      return requestDomain === domain;
    });

    if (!isAllowed) {
      res.status(403).json({
        success: false,
        error: 'Domain not allowed',
        message: 'Your domain is not authorized to use this API key'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Domain restriction check error:', error);
    next(); // Continue on error to avoid blocking legitimate requests
  }
};

/**
 * Form Access Restriction Middleware
 * Validates that the API key has access to the specified form
 */
export const checkFormAccess = (req: APIKeyRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.apiKey || !req.apiKey.restrictions || !req.apiKey.restrictions.allowedFormIds) {
      next();
      return;
    }

    const formId = req.params.formId || req.params.id || req.body.formId;
    const allowedFormIds = req.apiKey.restrictions.allowedFormIds;

    if (!formId || !allowedFormIds.includes(formId)) {
      res.status(403).json({
        success: false,
        error: 'Form access denied',
        message: 'This API key does not have access to the specified form'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Form access check error:', error);
    res.status(500).json({
      success: false,
      error: 'Form access check error',
      message: 'An error occurred while checking form access'
    });
  }
};

/**
 * Endpoint Restriction Middleware
 * Validates that the API key can access the current endpoint
 */
export const checkEndpointRestrictions = (req: APIKeyRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.apiKey || !req.apiKey.restrictions || !req.apiKey.restrictions.deniedEndpoints) {
      next();
      return;
    }

    const currentEndpoint = req.path;
    const deniedEndpoints = req.apiKey.restrictions.deniedEndpoints;

    const isDenied = deniedEndpoints.some(deniedPath => {
      // Support wildcard patterns
      if (deniedPath.includes('*')) {
        const pattern = deniedPath.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(currentEndpoint);
      }
      return currentEndpoint === deniedPath;
    });

    if (isDenied) {
      res.status(403).json({
        success: false,
        error: 'Endpoint access denied',
        message: 'This API key does not have access to this endpoint'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Endpoint restriction check error:', error);
    next(); // Continue on error to avoid blocking legitimate requests
  }
};

/**
 * Combined API Key Middleware
 * Applies all necessary API key validations in the correct order
 */
export const apiKeyProtect = [
  apiKeyAuth,
  checkIPRestrictions,
  checkDomainRestrictions,
  checkEndpointRestrictions
];

/**
 * API Key Rate Limiting Middleware
 * Note: This is a basic implementation. In production, use a dedicated
 * rate limiting service like Redis for distributed rate limiting
 */
export const apiKeyRateLimit = (req: APIKeyRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.apiKey || !req.apiKey.rateLimit) {
      next();
      return;
    }

    // This is a simplified rate limiting check
    // In production, implement proper rate limiting with Redis or similar
    const rateLimit = req.apiKey.rateLimit;
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit-Minute', rateLimit.requestsPerMinute);
    res.setHeader('X-RateLimit-Limit-Hour', rateLimit.requestsPerHour);
    res.setHeader('X-RateLimit-Limit-Day', rateLimit.requestsPerDay);

    // TODO: Implement actual rate limiting logic with storage backend
    // For now, we'll just add the headers and continue

    next();
  } catch (error) {
    console.error('Rate limit check error:', error);
    next(); // Continue on error
  }
};

export default {
  apiKeyAuth,
  requirePermission,
  requireScope,
  checkIPRestrictions,
  checkDomainRestrictions,
  checkFormAccess,
  checkEndpointRestrictions,
  apiKeyProtect,
  apiKeyRateLimit
};