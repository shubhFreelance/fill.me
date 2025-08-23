import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Integration from '../models/Integration';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';
import { IIntegration, IWebhookConfig, ISlackConfig, IGoogleSheetsConfig } from '../types';
import crypto from 'crypto';
import axios from 'axios';

const router = express.Router();

// Integration creation validation
const validateIntegration = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Integration name is required')
    .isLength({ max: 100 })
    .withMessage('Integration name cannot exceed 100 characters'),
  
  body('type')
    .isIn(['webhook', 'slack', 'google_sheets', 'zapier', 'email', 'sms'])
    .withMessage('Invalid integration type'),
  
  body('formId')
    .notEmpty()
    .withMessage('Form ID is required')
    .isMongoId()
    .withMessage('Invalid form ID format'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

// Webhook validation
const validateWebhook = [
  body('config.url')
    .isURL()
    .withMessage('Valid webhook URL is required'),
  
  body('config.method')
    .optional()
    .isIn(['POST', 'PUT', 'PATCH'])
    .withMessage('Invalid HTTP method'),
  
  body('config.headers')
    .optional()
    .isObject()
    .withMessage('Headers must be an object'),
  
  body('config.retryAttempts')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('Retry attempts must be between 0 and 5'),
];

// Slack validation
const validateSlack = [
  body('config.webhookUrl')
    .isURL()
    .withMessage('Valid Slack webhook URL is required'),
  
  body('config.channel')
    .optional()
    .trim()
    .matches(/^#[a-z0-9-_]+$/)
    .withMessage('Invalid Slack channel format'),
  
  body('config.username')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Username cannot exceed 50 characters'),
];

// Google Sheets validation
const validateGoogleSheets = [
  body('config.spreadsheetId')
    .notEmpty()
    .withMessage('Spreadsheet ID is required'),
  
  body('config.sheetName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Sheet name cannot exceed 100 characters'),
  
  body('config.credentials')
    .isObject()
    .withMessage('Google Sheets credentials are required'),
];

// Query interfaces
interface IntegrationQuery {
  page?: string;
  limit?: string;
  type?: string;
  formId?: string;
  isActive?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * @route   GET /api/integrations
 * @desc    Get user's integrations
 * @access  Private
 */
router.get('/', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      type,
      formId,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    }: IntegrationQuery = req.query;

    // Build query
    const query: any = { userId: req.user!._id };
    
    if (type) {
      query.type = type;
    }
    
    if (formId) {
      query.formId = formId;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Build sort options
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
      populate: [
        {
          path: 'formId',
          select: 'title description'
        }
      ]
    };

    const integrations = await (Integration as any).paginate(query, options);

    // Remove sensitive config data from response
    const sanitizedIntegrations = integrations.docs.map((integration: any) => {
      const integrationObj = integration.toObject();
      
      // Remove sensitive data based on integration type
      if (integrationObj.type === 'google_sheets' && integrationObj.config.credentials) {
        integrationObj.config.credentials = { configured: true };
      }
      
      if (integrationObj.type === 'webhook' && integrationObj.config.headers) {
        // Hide sensitive headers
        const sanitizedHeaders: any = {};
        Object.keys(integrationObj.config.headers).forEach(key => {
          if (key.toLowerCase().includes('authorization') || 
              key.toLowerCase().includes('token') || 
              key.toLowerCase().includes('key')) {
            sanitizedHeaders[key] = '***';
          } else {
            sanitizedHeaders[key] = integrationObj.config.headers[key];
          }
        });
        integrationObj.config.headers = sanitizedHeaders;
      }
      
      return integrationObj;
    });

    res.status(200).json({
      success: true,
      data: sanitizedIntegrations,
      pagination: {
        page: integrations.page,
        pages: integrations.totalPages,
        total: integrations.totalDocs,
        limit: integrations.limit
      }
    });
  } catch (error: any) {
    console.error('Get integrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching integrations'
    });
  }
});

/**
 * @route   POST /api/integrations
 * @desc    Create new integration
 * @access  Private
 */
router.post('/', protect, withValidation(validateIntegration), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, type, formId, config, isActive = true } = req.body;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Check user's subscription limits
    const userIntegrationsCount = await Integration.countDocuments({
      userId: req.user!._id,
      isActive: true
    });

    const maxIntegrations = req.user!.subscription?.plan === 'pro' ? 100 : 3;
    if (userIntegrationsCount >= maxIntegrations) {
      res.status(403).json({
        success: false,
        message: `Integration limit reached. ${req.user!.subscription?.plan === 'pro' ? 'Pro' : 'Free'} plan allows up to ${maxIntegrations} active integrations.`
      });
      return;
    }

    // Generate webhook secret for webhook integrations
    let finalConfig = config;
    if (type === 'webhook') {
      finalConfig = {
        ...config,
        secret: crypto.randomBytes(32).toString('hex')
      };
    }

    // Create integration
    const integration = await Integration.create({
      name,
      type,
      formId,
      userId: req.user!._id,
      config: finalConfig,
      isActive,
      lastTriggered: null,
      errorCount: 0,
      successCount: 0
    });

    await integration.populate('formId', 'title description');

    res.status(201).json({
      success: true,
      data: integration
    });
  } catch (error: any) {
    console.error('Create integration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating integration'
    });
  }
});

/**
 * @route   GET /api/integrations/:id
 * @desc    Get specific integration
 * @access  Private
 */
router.get('/:id', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const integration = await Integration.findOne({
      _id: req.params.id,
      userId: req.user!._id
    }).populate('formId', 'title description');

    if (!integration) {
      res.status(404).json({
        success: false,
        message: 'Integration not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: integration
    });
  } catch (error: any) {
    console.error('Get integration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching integration'
    });
  }
});

/**
 * @route   PUT /api/integrations/:id
 * @desc    Update integration
 * @access  Private
 */
router.put('/:id', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, config, isActive } = req.body;

    const integration = await Integration.findOne({
      _id: req.params.id,
      userId: req.user!._id
    });

    if (!integration) {
      res.status(404).json({
        success: false,
        message: 'Integration not found'
      });
      return;
    }

    // Update fields
    if (name !== undefined) integration.name = name;
    if (config !== undefined) {
      // Preserve webhook secret if not provided in update
      if (integration.type === 'webhook' && !config.secret) {
        config.secret = integration.config.secret;
      }
      integration.config = config;
    }
    if (isActive !== undefined) integration.isActive = isActive;

    integration.updatedAt = new Date();
    await integration.save();

    await integration.populate('formId', 'title description');

    res.status(200).json({
      success: true,
      data: integration
    });
  } catch (error: any) {
    console.error('Update integration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating integration'
    });
  }
});

/**
 * @route   DELETE /api/integrations/:id
 * @desc    Delete integration
 * @access  Private
 */
router.delete('/:id', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const integration = await Integration.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!._id
    });

    if (!integration) {
      res.status(404).json({
        success: false,
        message: 'Integration not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Integration deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete integration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting integration'
    });
  }
});

/**
 * @route   POST /api/integrations/:id/test
 * @desc    Test integration connection
 * @access  Private
 */
router.post('/:id/test', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const integration = await Integration.findOne({
      _id: req.params.id,
      userId: req.user!._id
    }).populate('formId');

    if (!integration) {
      res.status(404).json({
        success: false,
        message: 'Integration not found'
      });
      return;
    }

    let testResult: any = { success: false, message: 'Test failed' };

    // Test based on integration type
    switch (integration.type) {
      case 'webhook':
        testResult = await testWebhookIntegration(integration);
        break;
      case 'slack':
        testResult = await testSlackIntegration(integration);
        break;
      case 'google_sheets':
        testResult = await testGoogleSheetsIntegration(integration);
        break;
      default:
        testResult = { success: false, message: 'Integration type not supported for testing' };
    }

    // Update integration test status
    integration.lastTested = new Date();
    integration.testStatus = testResult.success ? 'passed' : 'failed';
    await integration.save();

    res.status(200).json({
      success: true,
      data: {
        testResult,
        lastTested: integration.lastTested,
        testStatus: integration.testStatus
      }
    });
  } catch (error: any) {
    console.error('Test integration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing integration'
    });
  }
});

/**
 * @route   GET /api/integrations/:id/logs
 * @desc    Get integration execution logs
 * @access  Private
 */
router.get('/:id/logs', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;

    const integration = await Integration.findOne({
      _id: req.params.id,
      userId: req.user!._id
    });

    if (!integration) {
      res.status(404).json({
        success: false,
        message: 'Integration not found'
      });
      return;
    }

    // Get logs with pagination
    const logs = integration.logs || [];
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedLogs = logs.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: paginatedLogs,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(logs.length / parseInt(limit)),
        total: logs.length,
        limit: parseInt(limit)
      }
    });
  } catch (error: any) {
    console.error('Get integration logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching integration logs'
    });
  }
});

// Helper functions for testing integrations

/**
 * Test webhook integration
 */
async function testWebhookIntegration(integration: any): Promise<any> {
  try {
    const config = integration.config as IWebhookConfig;
    
    const testPayload = {
      test: true,
      integrationId: integration._id,
      timestamp: new Date().toISOString(),
      form: {
        id: integration.formId._id,
        title: integration.formId.title
      },
      sampleData: {
        field1: 'Test value 1',
        field2: 'Test value 2'
      }
    };

    const response = await axios({
      method: config.method || 'POST',
      url: config.url,
      data: testPayload,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Youform-Integration/1.0',
        ...config.headers
      },
      timeout: 10000
    });

    return {
      success: true,
      message: `Webhook test successful. Status: ${response.status}`,
      statusCode: response.status,
      responseData: response.data
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Webhook test failed: ${error.message}`,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Test Slack integration
 */
async function testSlackIntegration(integration: any): Promise<any> {
  try {
    const config = integration.config as ISlackConfig;
    
    const testMessage = {
      text: `🧪 Integration Test from Youform`,
      attachments: [
        {
          color: 'good',
          fields: [
            {
              title: 'Form',
              value: integration.formId.title,
              short: true
            },
            {
              title: 'Integration',
              value: integration.name,
              short: true
            },
            {
              title: 'Status',
              value: 'Test successful! ✅',
              short: false
            }
          ],
          footer: 'Youform Integration',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    if (config.channel) {
      testMessage.attachments[0].fields.unshift({
        title: 'Channel',
        value: config.channel,
        short: true
      });
    }

    if (config.username) {
      (testMessage as any).username = config.username;
    }

    const response = await axios.post(config.webhookUrl, testMessage, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return {
      success: true,
      message: 'Slack test message sent successfully',
      statusCode: response.status
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Slack test failed: ${error.message}`,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Test Google Sheets integration
 */
async function testGoogleSheetsIntegration(integration: any): Promise<any> {
  try {
    const config = integration.config as IGoogleSheetsConfig;
    
    // This is a simplified test - in a real implementation, you would:
    // 1. Use Google Sheets API with proper authentication
    // 2. Validate credentials and permissions
    // 3. Test writing to the specified sheet
    
    if (!config.spreadsheetId || !config.credentials) {
      return {
        success: false,
        message: 'Missing required configuration: spreadsheetId or credentials'
      };
    }

    // For now, we'll just validate the configuration structure
    const requiredFields = ['client_email', 'private_key'];
    const missingFields = requiredFields.filter(field => !config.credentials[field]);
    
    if (missingFields.length > 0) {
      return {
        success: false,
        message: `Missing credentials fields: ${missingFields.join(', ')}`
      };
    }

    return {
      success: true,
      message: 'Google Sheets configuration is valid',
      note: 'Full API testing requires actual Google Sheets API integration'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Google Sheets test failed: ${error.message}`
    };
  }
}

/**
 * Trigger integrations for a form response
 * This function will be called when a new form response is submitted
 */
export async function triggerIntegrations(formId: string, responseData: any): Promise<void> {
  try {
    // Find all active integrations for this form
    const integrations = await Integration.find({
      formId,
      isActive: true
    });

    // Process each integration
    for (const integration of integrations) {
      try {
        await processIntegration(integration, responseData);
        
        // Update success metrics
        integration.successCount += 1;
        integration.lastTriggered = new Date();
        
        // Add success log
        integration.logs = integration.logs || [];
        integration.logs.unshift({
          timestamp: new Date(),
          status: 'success',
          message: 'Integration executed successfully',
          responseId: responseData._id
        });
        
        // Keep only last 100 logs
        if (integration.logs.length > 100) {
          integration.logs = integration.logs.slice(0, 100);
        }
        
        await integration.save();
      } catch (error: any) {
        console.error(`Integration ${integration._id} failed:`, error);
        
        // Update error metrics
        integration.errorCount += 1;
        integration.lastTriggered = new Date();
        
        // Add error log
        integration.logs = integration.logs || [];
        integration.logs.unshift({
          timestamp: new Date(),
          status: 'error',
          message: error.message || 'Integration execution failed',
          error: error.toString(),
          responseId: responseData._id
        });
        
        // Keep only last 100 logs
        if (integration.logs.length > 100) {
          integration.logs = integration.logs.slice(0, 100);
        }
        
        await integration.save();
      }
    }
  } catch (error: any) {
    console.error('Error triggering integrations:', error);
  }
}

/**
 * Process individual integration
 */
async function processIntegration(integration: any, responseData: any): Promise<void> {
  switch (integration.type) {
    case 'webhook':
      await processWebhookIntegration(integration, responseData);
      break;
    case 'slack':
      await processSlackIntegration(integration, responseData);
      break;
    case 'google_sheets':
      await processGoogleSheetsIntegration(integration, responseData);
      break;
    default:
      throw new Error(`Unsupported integration type: ${integration.type}`);
  }
}

/**
 * Process webhook integration
 */
async function processWebhookIntegration(integration: any, responseData: any): Promise<void> {
  const config = integration.config as IWebhookConfig;
  
  const payload = {
    integrationId: integration._id,
    formId: integration.formId,
    responseId: responseData._id,
    submittedAt: responseData.submittedAt,
    responses: responseData.responses,
    metadata: {
      userAgent: responseData.metadata?.userAgent,
      ipAddress: responseData.metadata?.ipAddress,
      referrer: responseData.metadata?.referrer
    }
  };

  // Add webhook signature for security
  const signature = crypto
    .createHmac('sha256', config.secret || '')
    .update(JSON.stringify(payload))
    .digest('hex');

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Youform-Integration/1.0',
    'X-Youform-Signature': signature,
    ...config.headers
  };

  let attempt = 0;
  const maxAttempts = config.retryAttempts || 3;
  
  while (attempt <= maxAttempts) {
    try {
      const response = await axios({
        method: config.method || 'POST',
        url: config.url,
        data: payload,
        headers,
        timeout: 30000
      });
      
      if (response.status >= 200 && response.status < 300) {
        return; // Success
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error: any) {
      attempt++;
      
      if (attempt > maxAttempts) {
        throw error;
      }
      
      // Exponential backoff for retries
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Process Slack integration
 */
async function processSlackIntegration(integration: any, responseData: any): Promise<void> {
  const config = integration.config as ISlackConfig;
  
  // Format form responses for Slack
  const formattedResponses = Object.entries(responseData.responses).map(([key, value]) => ({
    title: key,
    value: Array.isArray(value) ? value.join(', ') : String(value),
    short: String(value).length < 50
  }));

  const message = {
    text: `📝 New form submission received!`,
    attachments: [
      {
        color: 'good',
        fields: [
          {
            title: 'Form',
            value: integration.formId.title,
            short: true
          },
          {
            title: 'Submitted',
            value: new Date(responseData.submittedAt).toLocaleString(),
            short: true
          },
          ...formattedResponses
        ],
        footer: 'Youform',
        ts: Math.floor(new Date(responseData.submittedAt).getTime() / 1000)
      }
    ]
  };

  if (config.channel) {
    (message as any).channel = config.channel;
  }

  if (config.username) {
    (message as any).username = config.username;
  }

  await axios.post(config.webhookUrl, message, {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
}

/**
 * Process Google Sheets integration
 */
async function processGoogleSheetsIntegration(integration: any, responseData: any): Promise<void> {
  // This is a placeholder for Google Sheets integration
  // In a real implementation, you would:
  // 1. Use Google Sheets API
  // 2. Authenticate using service account credentials
  // 3. Append response data to the specified sheet
  
  console.log('Google Sheets integration triggered:', {
    integrationId: integration._id,
    responseId: responseData._id,
    spreadsheetId: integration.config.spreadsheetId
  });
  
  // For now, we'll just log the operation
  // TODO: Implement actual Google Sheets API integration
}

export default router;