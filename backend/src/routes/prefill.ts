import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Form from '../models/Form';
import PrefillService from '../services/PrefillService';

const router = express.Router();

const validatePrefill = [
  body('formId')
    .notEmpty()
    .withMessage('Form ID is required')
    .isMongoId()
    .withMessage('Invalid form ID format'),
  
  body('urlParams')
    .isObject()
    .withMessage('URL parameters must be an object'),
];

/**
 * @route   POST /api/prefill/process
 * @desc    Process URL parameters for form prefilling
 * @access  Public
 */
router.post('/process', withValidation(validatePrefill), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, urlParams } = req.body;

    const form = await Form.findById(formId).select('fields isPublic');
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    if (!form.isPublic) {
      res.status(403).json({
        success: false,
        message: 'Form is not public'
      });
      return;
    }

    const prefilledValues = PrefillService.processPrefillData(form.fields, urlParams);

    res.status(200).json({
      success: true,
      data: {
        prefilledValues,
        prefillCount: Object.keys(prefilledValues).length,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Prefill processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing prefill data'
    });
  }
});

/**
 * @route   POST /api/prefill/generate-url
 * @desc    Generate prefill URL for a form
 * @access  Private
 */
router.post('/generate-url', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, values, baseUrl } = req.body;

    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const finalBaseUrl = baseUrl || `${process.env.FRONTEND_URL}/form/${formId}`;
    const prefillUrl = PrefillService.generatePrefillUrl(finalBaseUrl, form.fields, values);

    res.status(200).json({
      success: true,
      data: {
        prefillUrl,
        baseUrl: finalBaseUrl,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Prefill URL generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating prefill URL'
    });
  }
});

export default router;