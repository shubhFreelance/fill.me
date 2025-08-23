import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import APIKeyService from '../services/APIKeyService';

const router = express.Router();

// Validation middleware
const validateCreateAPIKey = [
  body('name')
    .notEmpty()
    .withMessage('API key name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('API key name must be between 3 and 100 characters'),
  
  body('keyType')
    .isIn(['read_only', 'read_write', 'admin', 'webhook', 'public'])
    .withMessage('Invalid API key type'),
  
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
  
  body('scopes')
    .optional()
    .isArray()
    .withMessage('Scopes must be an array'),
  
  body('rateLimit')
    .optional()
    .isObject()
    .withMessage('Rate limit must be an object'),
  
  body('restrictions')
    .optional()
    .isObject()
    .withMessage('Restrictions must be an object'),
  
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be in ISO 8601 format'),
];

const validateUpdateAPIKey = [
  body('name')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('API key name must be between 3 and 100 characters'),
  
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
  
  body('scopes')
    .optional()
    .isArray()
    .withMessage('Scopes must be an array'),
  
  body('rateLimit')
    .optional()
    .isObject()
    .withMessage('Rate limit must be an object'),
  
  body('restrictions')
    .optional()
    .isObject()
    .withMessage('Restrictions must be an object'),
  
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be in ISO 8601 format'),
];

/**
 * @route   POST /api/api-keys
 * @desc    Create a new API key
 * @access  Private
 */
router.post('/', protect, withValidation(validateCreateAPIKey), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const keyData = {
      ...req.body,
      createdFrom: 'dashboard',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress
    };

    const result = await APIKeyService.generateAPIKey(userId, keyData);

    res.status(201).json({
      success: true,
      data: result,
      message: 'API key created successfully. Save the key securely as it will not be shown again.'
    });
  } catch (error: any) {
    console.error('Create API key error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error creating API key'
    });
  }
});

/**
 * @route   GET /api/api-keys
 * @desc    List all API keys for the authenticated user
 * @access  Private
 */
router.get('/', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const result = await APIKeyService.listAPIKeys(userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('List API keys error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching API keys'
    });
  }
});

/**
 * @route   GET /api/api-keys/:keyId
 * @desc    Get details of a specific API key
 * @access  Private
 */
router.get('/:keyId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { keyId } = req.params;

    const result = await APIKeyService.listAPIKeys(userId);
    const apiKey = result.apiKeys.find(key => key.id === keyId);

    if (!apiKey) {
      res.status(404).json({
        success: false,
        message: 'API key not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: apiKey
    });
  } catch (error: any) {
    console.error('Get API key error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching API key'
    });
  }
});

/**
 * @route   PUT /api/api-keys/:keyId
 * @desc    Update an API key
 * @access  Private
 */
router.put('/:keyId', protect, withValidation(validateUpdateAPIKey), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { keyId } = req.params;
    const updates = req.body;

    const result = await APIKeyService.updateAPIKey(userId, keyId, updates);

    res.status(200).json({
      success: true,
      data: result,
      message: 'API key updated successfully'
    });
  } catch (error: any) {
    console.error('Update API key error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error updating API key'
    });
  }
});

/**
 * @route   DELETE /api/api-keys/:keyId
 * @desc    Revoke/delete an API key
 * @access  Private
 */
router.delete('/:keyId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { keyId } = req.params;

    const result = await APIKeyService.revokeAPIKey(userId, keyId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'API key revoked successfully'
    });
  } catch (error: any) {
    console.error('Revoke API key error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error revoking API key'
    });
  }
});

/**
 * @route   GET /api/api-keys/:keyId/usage
 * @desc    Get usage statistics for a specific API key
 * @access  Private
 */
router.get('/:keyId/usage', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { keyId } = req.params;

    const result = await APIKeyService.getAPIKeyUsage(userId, keyId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Get API key usage error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching API key usage'
    });
  }
});

/**
 * @route   GET /api/api-keys/usage/overview
 * @desc    Get overall API key usage statistics for the user
 * @access  Private
 */
router.get('/usage/overview', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();

    const result = await APIKeyService.getAPIKeyUsage(userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Get API key usage overview error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching API key usage overview'
    });
  }
});

/**
 * @route   POST /api/api-keys/:keyId/regenerate
 * @desc    Regenerate an API key (creates new key, revokes old one)
 * @access  Private
 */
router.post('/:keyId/regenerate', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { keyId } = req.params;

    // Get existing key details
    const existingKeys = await APIKeyService.listAPIKeys(userId);
    const existingKey = existingKeys.apiKeys.find(key => key.id === keyId);

    if (!existingKey) {
      res.status(404).json({
        success: false,
        message: 'API key not found'
      });
      return;
    }

    if (!existingKey.isActive) {
      res.status(400).json({
        success: false,
        message: 'Cannot regenerate inactive API key'
      });
      return;
    }

    // Create new key with same settings
    const newKeyData = {
      name: `${existingKey.name} (Regenerated)`,
      keyType: existingKey.keyType,
      permissions: existingKey.permissions,
      scopes: existingKey.scopes,
      rateLimit: existingKey.rateLimit,
      restrictions: existingKey.restrictions,
      expiresAt: existingKey.expiresAt,
      createdFrom: 'regeneration',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress
    };

    const newKey = await APIKeyService.generateAPIKey(userId, newKeyData);

    // Revoke old key
    await APIKeyService.revokeAPIKey(userId, keyId);

    res.status(201).json({
      success: true,
      data: newKey,
      message: 'API key regenerated successfully. The old key has been revoked.'
    });
  } catch (error: any) {
    console.error('Regenerate API key error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error regenerating API key'
    });
  }
});

/**
 * @route   GET /api/api-keys/types
 * @desc    Get available API key types and their capabilities
 * @access  Private
 */
router.get('/types', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const keyTypes = {
      read_only: {
        name: 'Read Only',
        description: 'Can read forms, responses, and analytics but cannot create or modify data',
        permissions: {
          forms: { read: true, create: false, update: false, delete: false },
          responses: { read: true, create: false, update: false, delete: false },
          analytics: { read: true, create: false, update: false, delete: false },
          webhooks: { read: false, create: false, update: false, delete: false },
          users: { read: false, create: false, update: false, delete: false }
        },
        rateLimit: { requestsPerMinute: 100, requestsPerHour: 1000, requestsPerDay: 10000 },
        defaultExpiry: '365 days',
        useCase: 'Data analysis, reporting, dashboard displays'
      },
      read_write: {
        name: 'Read/Write',
        description: 'Can read and modify forms, responses, and webhooks',
        permissions: {
          forms: { read: true, create: true, update: true, delete: false },
          responses: { read: true, create: true, update: true, delete: false },
          analytics: { read: true, create: false, update: false, delete: false },
          webhooks: { read: true, create: true, update: true, delete: true },
          users: { read: false, create: false, update: false, delete: false }
        },
        rateLimit: { requestsPerMinute: 60, requestsPerHour: 600, requestsPerDay: 5000 },
        defaultExpiry: '365 days',
        useCase: 'Form management, data collection, webhook configuration'
      },
      admin: {
        name: 'Admin',
        description: 'Full access to all resources including user management',
        permissions: {
          forms: { read: true, create: true, update: true, delete: true },
          responses: { read: true, create: true, update: true, delete: true },
          analytics: { read: true, create: true, update: true, delete: true },
          webhooks: { read: true, create: true, update: true, delete: true },
          users: { read: true, create: false, update: true, delete: false }
        },
        rateLimit: { requestsPerMinute: 120, requestsPerHour: 1200, requestsPerDay: 12000 },
        defaultExpiry: '90 days',
        useCase: 'Full platform management, administrative tasks'
      },
      webhook: {
        name: 'Webhook',
        description: 'Specialized for webhook endpoints, can only submit responses',
        permissions: {
          forms: { read: true, create: false, update: false, delete: false },
          responses: { read: false, create: true, update: false, delete: false },
          analytics: { read: false, create: false, update: false, delete: false },
          webhooks: { read: false, create: false, update: false, delete: false },
          users: { read: false, create: false, update: false, delete: false }
        },
        rateLimit: { requestsPerMinute: 30, requestsPerHour: 300, requestsPerDay: 3000 },
        defaultExpiry: 'No expiry',
        useCase: 'Third-party integrations, automated data submission'
      },
      public: {
        name: 'Public',
        description: 'Limited access for public form embedding and submissions',
        permissions: {
          forms: { read: true, create: false, update: false, delete: false },
          responses: { read: false, create: true, update: false, delete: false },
          analytics: { read: false, create: false, update: false, delete: false },
          webhooks: { read: false, create: false, update: false, delete: false },
          users: { read: false, create: false, update: false, delete: false }
        },
        rateLimit: { requestsPerMinute: 20, requestsPerHour: 200, requestsPerDay: 2000 },
        defaultExpiry: '30 days',
        useCase: 'Public form embeds, website integrations'
      }
    };

    res.status(200).json({
      success: true,
      data: {
        keyTypes,
        defaultScopes: [
          'forms:read',
          'forms:write',
          'responses:read',
          'responses:write',
          'analytics:read',
          'webhooks:manage'
        ],
        restrictionOptions: {
          ipRestrictions: 'Limit access to specific IP addresses',
          domainRestrictions: 'Limit access to specific domains (for web requests)',
          formRestrictions: 'Limit access to specific forms',
          endpointRestrictions: 'Block access to specific API endpoints'
        }
      }
    });
  } catch (error: any) {
    console.error('Get API key types error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching API key types'
    });
  }
});

export default router;