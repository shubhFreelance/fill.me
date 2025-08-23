import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Form from '../models/Form';
import QRCodeService from '../services/QRCodeService';

const router = express.Router();

// QR code generation validation
const validateQRGeneration = [
  body('formId')
    .notEmpty()
    .withMessage('Form ID is required')
    .isMongoId()
    .withMessage('Invalid form ID format'),
  
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  
  body('options.size')
    .optional()
    .isInt({ min: 50, max: 1000 })
    .withMessage('Size must be between 50 and 1000 pixels'),
  
  body('options.format')
    .optional()
    .isIn(['png', 'svg'])
    .withMessage('Format must be png or svg'),
];

/**
 * @route   POST /api/qrcode/generate
 * @desc    Generate QR code for form
 * @access  Private
 */
router.post('/generate', protect, withValidation(validateQRGeneration), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, options = {} } = req.body;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const formUrl = `${baseUrl}/form/${formId}`;

    const qrCode = await QRCodeService.generateQRCode(formUrl, options);

    res.status(200).json({
      success: true,
      data: {
        qrCode,
        formUrl,
        formId,
        options,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('QR code generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating QR code'
    });
  }
});

/**
 * @route   POST /api/qrcode/generate-multiple
 * @desc    Generate multiple QR codes for different form purposes
 * @access  Private
 */
router.post('/generate-multiple', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.body;

    if (!formId) {
      res.status(400).json({
        success: false,
        message: 'Form ID is required'
      });
      return;
    }

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrCodes = await QRCodeService.generateFormQRCodes(formId, baseUrl);

    res.status(200).json({
      success: true,
      data: {
        qrCodes,
        formId,
        formTitle: form.title,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Multiple QR codes generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating QR codes'
    });
  }
});

/**
 * @route   POST /api/qrcode/generate-tracking
 * @desc    Generate QR code with tracking parameters
 * @access  Private
 */
router.post('/generate-tracking', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, trackingParams = {}, options = {} } = req.body;

    if (!formId) {
      res.status(400).json({
        success: false,
        message: 'Form ID is required'
      });
      return;
    }

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const formUrl = `${baseUrl}/form/${formId}`;

    const qrCode = await QRCodeService.generateTrackingQRCode(formUrl, trackingParams, options);

    res.status(200).json({
      success: true,
      data: {
        qrCode,
        formUrl,
        trackingParams,
        formId,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Tracking QR code generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating tracking QR code'
    });
  }
});

/**
 * @route   POST /api/qrcode/generate-styled
 * @desc    Generate styled QR code with custom appearance
 * @access  Private
 */
router.post('/generate-styled', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, style = {} } = req.body;

    if (!formId) {
      res.status(400).json({
        success: false,
        message: 'Form ID is required'
      });
      return;
    }

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const formUrl = `${baseUrl}/form/${formId}`;

    // Use form's primary color as default if available
    const defaultStyle = {
      primaryColor: form.customization?.primaryColor || '#000000',
      backgroundColor: form.customization?.backgroundColor || '#FFFFFF',
      ...style
    };

    const qrCode = await QRCodeService.generateStyledQRCode(formUrl, defaultStyle);

    res.status(200).json({
      success: true,
      data: {
        qrCode,
        formUrl,
        style: defaultStyle,
        formId,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Styled QR code generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating styled QR code'
    });
  }
});

/**
 * @route   POST /api/qrcode/save-file
 * @desc    Generate and save QR code as file
 * @access  Private
 */
router.post('/save-file', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, filename, options = {} } = req.body;

    if (!formId) {
      res.status(400).json({
        success: false,
        message: 'Form ID is required'
      });
      return;
    }

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const formUrl = `${baseUrl}/form/${formId}`;
    const finalFilename = filename || `form-${formId}-qr-${Date.now()}`;

    const filePath = await QRCodeService.generateQRCodeFile(formUrl, finalFilename, options);

    res.status(200).json({
      success: true,
      data: {
        filePath,
        filename: finalFilename,
        formUrl,
        formId,
        downloadUrl: `${req.protocol}://${req.get('host')}${filePath}`,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('QR code file generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating QR code file'
    });
  }
});

/**
 * @route   POST /api/qrcode/custom-data
 * @desc    Generate QR code with custom data (vCard, WiFi, etc.)
 * @access  Private
 */
router.post('/custom-data', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, data, options = {} } = req.body;

    if (!type || !data) {
      res.status(400).json({
        success: false,
        message: 'Type and data are required'
      });
      return;
    }

    const supportedTypes = ['vcard', 'wifi', 'email', 'sms', 'geo'];
    if (!supportedTypes.includes(type)) {
      res.status(400).json({
        success: false,
        message: `Unsupported type. Supported types: ${supportedTypes.join(', ')}`
      });
      return;
    }

    const qrCode = await QRCodeService.generateCustomDataQRCode(type, data, options);

    res.status(200).json({
      success: true,
      data: {
        qrCode,
        type,
        data,
        options,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Custom data QR code generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating custom data QR code'
    });
  }
});

/**
 * @route   GET /api/qrcode/validate
 * @desc    Validate QR code generation parameters
 * @access  Public
 */
router.get('/validate', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const params = req.query;
    const validation = QRCodeService.validateQRParams(params);

    res.status(200).json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('QR code validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating QR code parameters'
    });
  }
});

export default router;