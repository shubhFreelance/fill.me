import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import GDPRComplianceService from '../services/GDPRComplianceService';
import Form from '../models/Form';
import crypto from 'crypto';

const router = express.Router();

// Validation middleware
const validateConsentRecord = [
  body('consentType')
    .isIn(['data_processing', 'marketing', 'analytics', 'cookies', 'third_party_sharing'])
    .withMessage('Invalid consent type'),
  
  body('purpose')
    .notEmpty()
    .withMessage('Purpose is required')
    .isLength({ max: 500 })
    .withMessage('Purpose cannot exceed 500 characters'),
  
  body('legalBasis')
    .isIn(['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'])
    .withMessage('Invalid legal basis'),
  
  body('consentGiven')
    .isBoolean()
    .withMessage('Consent given must be boolean'),
  
  body('consentMethod')
    .isIn(['checkbox', 'button_click', 'form_submission', 'email_confirmation'])
    .withMessage('Invalid consent method'),
];

const validateAccessRequest = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID'),
  
  body('verificationMethod')
    .isIn(['email', 'identity_document', 'account_login'])
    .withMessage('Invalid verification method'),
];

const validateErasureRequest = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID'),
  
  body('erasureScope')
    .isArray({ min: 1 })
    .withMessage('Erasure scope must be a non-empty array'),
  
  body('erasureScope.*')
    .isIn(['account_data', 'form_responses', 'forms', 'analytics_data'])
    .withMessage('Invalid erasure scope item'),
  
  body('verificationMethod')
    .isIn(['email', 'identity_document', 'account_login'])
    .withMessage('Invalid verification method'),
];

const validatePortabilityRequest = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID'),
  
  body('exportFormat')
    .optional()
    .isIn(['json', 'csv', 'xml'])
    .withMessage('Invalid export format'),
  
  body('verificationMethod')
    .isIn(['email', 'identity_document', 'account_login'])
    .withMessage('Invalid verification method'),
];

/**
 * @route   POST /api/gdpr/consent/record
 * @desc    Record user consent for data processing
 * @access  Public
 */
router.post('/consent/record', withValidation(validateConsentRecord), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { userId, consentType, consentData } = req.body;

    // Enrich consent data with request information
    const enrichedConsentData = {
      ...consentData,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      source: 'api_request'
    };

    const consentRecord = await GDPRComplianceService.recordConsent(
      userId,
      consentType,
      enrichedConsentData
    );

    res.status(201).json({
      success: true,
      data: {
        consentId: consentRecord.id,
        consentTimestamp: consentRecord.consentTimestamp,
        consentType: consentRecord.consentType,
        isActive: consentRecord.isActive
      }
    });
  } catch (error: any) {
    console.error('Record consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording consent'
    });
  }
});

/**
 * @route   POST /api/gdpr/consent/revoke
 * @desc    Revoke user consent
 * @access  Public
 */
router.post('/consent/revoke', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { consentId, userId, revocationMethod = 'button_click' } = req.body;

    if (!consentId) {
      res.status(400).json({
        success: false,
        message: 'Consent ID is required'
      });
      return;
    }

    const revocationData = {
      userId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      revocationMethod
    };

    const updatedConsent = await GDPRComplianceService.revokeConsent(
      consentId,
      revocationData
    );

    res.status(200).json({
      success: true,
      data: {
        consentId: updatedConsent.id,
        revokedAt: updatedConsent.revokedAt,
        isActive: updatedConsent.isActive
      }
    });
  } catch (error: any) {
    console.error('Revoke consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error revoking consent'
    });
  }
});

/**
 * @route   POST /api/gdpr/request/access
 * @desc    Handle data subject access request (Right of Access)
 * @access  Public
 */
router.post('/request/access', withValidation(validateAccessRequest), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { email, userId, verificationMethod } = req.body;

    if (!email && !userId) {
      res.status(400).json({
        success: false,
        message: 'Either email or userId is required'
      });
      return;
    }

    const requestData = {
      email,
      userId,
      verificationMethod,
      requestId: crypto.randomUUID()
    };

    const accessResponse = await GDPRComplianceService.handleAccessRequest(requestData);

    res.status(200).json({
      success: true,
      data: {
        requestId: accessResponse.requestId,
        requestDate: accessResponse.requestDate,
        dataExported: accessResponse.dataExported,
        exportFormat: accessResponse.exportFormat,
        retentionNotice: accessResponse.retentionNotice,
        dataProcessingPurposes: accessResponse.dataProcessingPurposes,
        userRights: accessResponse.userRights
      }
    });
  } catch (error: any) {
    console.error('Access request error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error processing access request'
    });
  }
});

/**
 * @route   POST /api/gdpr/request/erasure
 * @desc    Handle data erasure request (Right to be Forgotten)
 * @access  Public
 */
router.post('/request/erasure', withValidation(validateErasureRequest), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { email, userId, erasureScope, verificationMethod } = req.body;

    if (!email && !userId) {
      res.status(400).json({
        success: false,
        message: 'Either email or userId is required'
      });
      return;
    }

    const requestData = {
      email,
      userId,
      erasureScope,
      verificationMethod,
      requestId: crypto.randomUUID()
    };

    const erasureResponse = await GDPRComplianceService.handleErasureRequest(requestData);

    res.status(200).json({
      success: true,
      data: {
        requestId: erasureResponse.requestId,
        requestDate: erasureResponse.requestDate,
        erasureCompleted: erasureResponse.erasureCompleted,
        erasureResults: erasureResponse.erasureResults,
        retainedData: erasureResponse.retainedData,
        legalObligations: erasureResponse.legalObligations
      }
    });
  } catch (error: any) {
    console.error('Erasure request error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error processing erasure request'
    });
  }
});

/**
 * @route   POST /api/gdpr/request/portability
 * @desc    Handle data portability request (Right to Data Portability)
 * @access  Public
 */
router.post('/request/portability', withValidation(validatePortabilityRequest), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { email, userId, exportFormat = 'json', verificationMethod } = req.body;

    if (!email && !userId) {
      res.status(400).json({
        success: false,
        message: 'Either email or userId is required'
      });
      return;
    }

    const requestData = {
      email,
      userId,
      exportFormat,
      verificationMethod,
      requestId: crypto.randomUUID()
    };

    const portabilityResponse = await GDPRComplianceService.handlePortabilityRequest(requestData);

    res.status(200).json({
      success: true,
      data: {
        requestId: portabilityResponse.requestId,
        requestDate: portabilityResponse.requestDate,
        exportFormat: portabilityResponse.exportFormat,
        portableData: portabilityResponse.portableData,
        dataCategories: portabilityResponse.dataCategories,
        technicalDetails: portabilityResponse.technicalDetails
      }
    });
  } catch (error: any) {
    console.error('Portability request error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error processing portability request'
    });
  }
});

/**
 * @route   GET /api/gdpr/form/:formId/compliance
 * @desc    Validate GDPR compliance for a form
 * @access  Private
 */
router.get('/form/:formId/compliance', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const validation = await GDPRComplianceService.validateFormCompliance(formId);

    res.status(200).json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('Form compliance validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating form compliance'
    });
  }
});

/**
 * @route   GET /api/gdpr/form/:formId/processing-record
 * @desc    Generate data processing record for a form
 * @access  Private
 */
router.get('/form/:formId/processing-record', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const processingRecord = await GDPRComplianceService.generateDataProcessingRecord(formId);

    res.status(200).json({
      success: true,
      data: processingRecord
    });
  } catch (error: any) {
    console.error('Processing record generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating processing record'
    });
  }
});

/**
 * @route   PUT /api/gdpr/form/:formId/settings
 * @desc    Update GDPR settings for a form
 * @access  Private
 */
router.put('/form/:formId/settings', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { gdprSettings } = req.body;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Validate GDPR settings
    if (!gdprSettings || typeof gdprSettings !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Invalid GDPR settings'
      });
      return;
    }

    // Update form with GDPR settings
    if (!form.settings) {
      form.settings = {} as any;
    }

    form.settings.gdpr = {
      enabled: Boolean(gdprSettings.enabled),
      consentText: gdprSettings.consentText || '',
      privacyPolicyUrl: gdprSettings.privacyPolicyUrl || '',
      dataRetentionDays: Math.max(1, Math.min(2555, gdprSettings.dataRetentionDays || 365)),
      legalBasis: gdprSettings.legalBasis || 'consent',
      dataController: gdprSettings.dataController || {},
      processingPurposes: gdprSettings.processingPurposes || [],
      dataCategories: gdprSettings.dataCategories || [],
      recipients: gdprSettings.recipients || [],
      internationalTransfers: Boolean(gdprSettings.internationalTransfers)
    };

    await form.save();

    // Validate compliance after update
    const validation = await GDPRComplianceService.validateFormCompliance(formId);

    res.status(200).json({
      success: true,
      data: {
        gdprSettings: form.settings.gdpr,
        complianceValidation: validation
      }
    });
  } catch (error: any) {
    console.error('Update GDPR settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating GDPR settings'
    });
  }
});

/**
 * @route   GET /api/gdpr/requirements
 * @desc    Get GDPR compliance requirements and guidelines
 * @access  Public
 */
router.get('/requirements', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const requirements = {
      principles: [
        {
          name: 'Lawfulness, fairness and transparency',
          description: 'Processing must be lawful, fair and transparent to the data subject'
        },
        {
          name: 'Purpose limitation',
          description: 'Data must be collected for specified, explicit and legitimate purposes'
        },
        {
          name: 'Data minimisation',
          description: 'Data must be adequate, relevant and limited to what is necessary'
        },
        {
          name: 'Accuracy',
          description: 'Data must be accurate and kept up to date'
        },
        {
          name: 'Storage limitation',
          description: 'Data must not be kept longer than necessary'
        },
        {
          name: 'Integrity and confidentiality',
          description: 'Data must be processed securely'
        },
        {
          name: 'Accountability',
          description: 'Controllers must demonstrate compliance with GDPR'
        }
      ],
      dataSubjectRights: [
        {
          right: 'Right to be informed',
          description: 'Individuals have the right to be informed about data collection and use'
        },
        {
          right: 'Right of access',
          description: 'Individuals have the right to access their personal data'
        },
        {
          right: 'Right to rectification',
          description: 'Individuals have the right to correct inaccurate data'
        },
        {
          right: 'Right to erasure',
          description: 'Individuals have the right to have data deleted'
        },
        {
          right: 'Right to restrict processing',
          description: 'Individuals have the right to limit data processing'
        },
        {
          right: 'Right to data portability',
          description: 'Individuals have the right to move data between services'
        },
        {
          right: 'Right to object',
          description: 'Individuals have the right to object to data processing'
        },
        {
          right: 'Rights related to automated decision making',
          description: 'Rights regarding automated processing and profiling'
        }
      ],
      legalBases: [
        {
          basis: 'Consent',
          description: 'The individual has given clear consent'
        },
        {
          basis: 'Contract',
          description: 'Processing is necessary for a contract'
        },
        {
          basis: 'Legal obligation',
          description: 'Processing is necessary for legal compliance'
        },
        {
          basis: 'Vital interests',
          description: 'Processing is necessary to protect life'
        },
        {
          basis: 'Public task',
          description: 'Processing is necessary for public interest'
        },
        {
          basis: 'Legitimate interests',
          description: 'Processing is necessary for legitimate interests'
        }
      ],
      complianceChecklist: [
        'Enable GDPR compliance in form settings',
        'Add clear consent text explaining data processing',
        'Provide privacy policy link',
        'Set appropriate data retention period',
        'Identify legal basis for processing',
        'Implement data subject rights procedures',
        'Maintain processing records',
        'Implement security measures',
        'Conduct compliance audits',
        'Train staff on GDPR requirements'
      ]
    };

    res.status(200).json({
      success: true,
      data: requirements
    });
  } catch (error: any) {
    console.error('Get requirements error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching GDPR requirements'
    });
  }
});

export default router;