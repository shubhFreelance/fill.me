import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Form from '../models/Form';
import TypeformImportService from '../services/TypeformImportService';

const router = express.Router();

// Import validation
const validateImport = [
  body('data')
    .notEmpty()
    .withMessage('Typeform data is required')
    .isObject()
    .withMessage('Data must be a valid JSON object'),
];

const validateUrlImport = [
  body('url')
    .notEmpty()
    .withMessage('Typeform URL is required')
    .isURL()
    .withMessage('Must be a valid URL'),
  
  body('apiKey')
    .optional()
    .isString()
    .withMessage('API key must be a string'),
];

/**
 * @route   POST /api/typeform/import
 * @desc    Import form from Typeform JSON data
 * @access  Private
 */
router.post('/import', protect, withValidation(validateImport), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { data, title: customTitle } = req.body;

    // Validate Typeform data structure
    const validation = TypeformImportService.validateTypeformData(data);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid Typeform data format',
        errors: validation.errors
      });
      return;
    }

    // Convert Typeform data to our format
    const convertedForm = await TypeformImportService.importFromTypeform(data, req.user!._id.toString());

    // Override title if provided
    if (customTitle) {
      convertedForm.title = customTitle;
    }

    // Create the form
    const form = await Form.create({
      ...convertedForm,
      userId: req.user!._id,
      isPublic: false,
      analytics: {
        views: 0,
        submissions: 0,
        starts: 0,
        completions: 0,
        abandons: 0,
        averageCompletionTime: 0,
        fieldDropoffs: new Map(),
        deviceStats: { mobile: 0, tablet: 0, desktop: 0 },
        referrerStats: new Map()
      }
    });

    res.status(201).json({
      success: true,
      data: {
        formId: form._id,
        title: form.title,
        fieldCount: form.fields.length,
        importedAt: new Date().toISOString(),
        preview: TypeformImportService.generateImportPreview(data)
      }
    });
  } catch (error: any) {
    console.error('Typeform import error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error importing form from Typeform'
    });
  }
});

/**
 * @route   POST /api/typeform/import-url
 * @desc    Import form from Typeform URL
 * @access  Private
 */
router.post('/import-url', protect, withValidation(validateUrlImport), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { url, apiKey, title: customTitle } = req.body;

    // Extract form ID from URL
    const formId = TypeformImportService.parseTypeformUrl(url);
    if (!formId) {
      res.status(400).json({
        success: false,
        message: 'Invalid Typeform URL format'
      });
      return;
    }

    if (!apiKey) {
      res.status(400).json({
        success: false,
        message: 'Typeform API key is required for URL import'
      });
      return;
    }

    // Fetch form data from Typeform API
    const typeformData = await TypeformImportService.importFromTypeformAPI(formId, apiKey);

    // Convert and create form
    const convertedForm = await TypeformImportService.importFromTypeform(typeformData, req.user!._id.toString());

    // Override title if provided
    if (customTitle) {
      convertedForm.title = customTitle;
    }

    // Create the form
    const form = await Form.create({
      ...convertedForm,
      userId: req.user!._id,
      isPublic: false,
      analytics: {
        views: 0,
        submissions: 0,
        starts: 0,
        completions: 0,
        abandons: 0,
        averageCompletionTime: 0,
        fieldDropoffs: new Map(),
        deviceStats: { mobile: 0, tablet: 0, desktop: 0 },
        referrerStats: new Map()
      }
    });

    res.status(201).json({
      success: true,
      data: {
        formId: form._id,
        title: form.title,
        fieldCount: form.fields.length,
        originalUrl: url,
        importedAt: new Date().toISOString(),
        preview: TypeformImportService.generateImportPreview(typeformData)
      }
    });
  } catch (error: any) {
    console.error('Typeform URL import error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error importing form from Typeform URL'
    });
  }
});

/**
 * @route   POST /api/typeform/preview
 * @desc    Preview Typeform import without creating form
 * @access  Private
 */
router.post('/preview', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { data } = req.body;

    if (!data) {
      res.status(400).json({
        success: false,
        message: 'Typeform data is required'
      });
      return;
    }

    // Validate data structure
    const validation = TypeformImportService.validateTypeformData(data);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid Typeform data format',
        errors: validation.errors
      });
      return;
    }

    // Generate preview
    const preview = TypeformImportService.generateImportPreview(data);

    // Convert fields for preview
    const convertedFields = TypeformImportService.convertTypeformFields(data.fields || []);

    res.status(200).json({
      success: true,
      data: {
        preview,
        convertedFields: convertedFields.slice(0, 5), // Show first 5 fields
        totalFields: convertedFields.length,
        supportedTypes: convertedFields.map(f => f.type),
        originalTitle: data.title
      }
    });
  } catch (error: any) {
    console.error('Typeform preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating preview'
    });
  }
});

/**
 * @route   POST /api/typeform/validate
 * @desc    Validate Typeform data structure
 * @access  Public
 */
router.post('/validate', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { data } = req.body;

    if (!data) {
      res.status(400).json({
        success: false,
        message: 'Data is required for validation'
      });
      return;
    }

    const validation = TypeformImportService.validateTypeformData(data);

    res.status(200).json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('Typeform validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating Typeform data'
    });
  }
});

/**
 * @route   GET /api/typeform/parse-url/:url
 * @desc    Parse Typeform URL to extract form ID
 * @access  Public
 */
router.get('/parse-url/*', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const url = req.params[0]; // Get the full URL from the wildcard

    if (!url) {
      res.status(400).json({
        success: false,
        message: 'URL is required'
      });
      return;
    }

    const formId = TypeformImportService.parseTypeformUrl(url);

    if (formId) {
      res.status(200).json({
        success: true,
        data: {
          formId,
          isValid: true,
          originalUrl: url
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid Typeform URL format',
        data: {
          isValid: false,
          originalUrl: url
        }
      });
    }
  } catch (error: any) {
    console.error('URL parsing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error parsing URL'
    });
  }
});

/**
 * @route   POST /api/typeform/export
 * @desc    Export our form to Typeform-compatible format
 * @access  Private
 */
router.post('/export', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Convert to Typeform format
    const typeformData = TypeformImportService.exportToTypeformFormat(form);

    res.status(200).json({
      success: true,
      data: {
        typeformData,
        formId,
        exportedAt: new Date().toISOString(),
        instructions: 'You can import this JSON data into Typeform or use it as a backup'
      }
    });
  } catch (error: any) {
    console.error('Typeform export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting form to Typeform format'
    });
  }
});

/**
 * @route   GET /api/typeform/supported-types
 * @desc    Get list of supported field types for import
 * @access  Public
 */
router.get('/supported-types', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const supportedTypes = {
      'short_text': { ourType: 'text', supported: true, notes: 'Fully supported' },
      'long_text': { ourType: 'textarea', supported: true, notes: 'Fully supported' },
      'multiple_choice': { ourType: 'radio', supported: true, notes: 'Converts to radio or checkbox based on settings' },
      'dropdown': { ourType: 'dropdown', supported: true, notes: 'Fully supported' },
      'yes_no': { ourType: 'radio', supported: true, notes: 'Converts to radio with Yes/No options' },
      'email': { ourType: 'email', supported: true, notes: 'Fully supported' },
      'number': { ourType: 'number', supported: true, notes: 'Fully supported' },
      'date': { ourType: 'date', supported: true, notes: 'Fully supported' },
      'file_upload': { ourType: 'file', supported: true, notes: 'File type restrictions may differ' },
      'phone_number': { ourType: 'phone', supported: true, notes: 'Fully supported' },
      'website': { ourType: 'url', supported: true, notes: 'Fully supported' },
      'rating': { ourType: 'rating', supported: true, notes: 'Scale settings preserved' },
      'opinion_scale': { ourType: 'scale', supported: true, notes: 'Range and labels preserved' },
      'picture_choice': { ourType: 'radio', supported: true, notes: 'Images not imported, converts to text options' },
      'legal': { ourType: 'checkbox', supported: true, notes: 'Converts to single checkbox' },
      'statement': { ourType: 'heading', supported: true, notes: 'Converts to heading field' },
      'group': { ourType: 'divider', supported: true, notes: 'Converts to divider' },
      'payment': { ourType: 'text', supported: false, notes: 'Not supported, converts to text field' },
      'matrix': { ourType: 'text', supported: false, notes: 'Not supported, converts to text field' }
    };

    res.status(200).json({
      success: true,
      data: {
        supportedTypes,
        totalSupported: Object.values(supportedTypes).filter(t => t.supported).length,
        totalTypes: Object.keys(supportedTypes).length
      }
    });
  } catch (error: any) {
    console.error('Error getting supported types:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting supported types'
    });
  }
});

export default router;