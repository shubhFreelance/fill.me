import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Form from '../models/Form';
import CalculatorService from '../services/CalculatorService';

const router = express.Router();

// Calculator processing validation
const validateCalculation = [
  body('formId')
    .notEmpty()
    .withMessage('Form ID is required')
    .isMongoId()
    .withMessage('Invalid form ID format'),
  
  body('responses')
    .isObject()
    .withMessage('Responses must be an object'),
];

/**
 * @route   POST /api/calculator/process
 * @desc    Process calculations for form fields
 * @access  Public (for form rendering)
 */
router.post('/process', withValidation(validateCalculation), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, responses } = req.body;

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

    // Process calculations
    const calculatedValues = CalculatorService.processCalculations(form.fields, responses);

    res.status(200).json({
      success: true,
      data: {
        calculatedValues,
        calculationCount: Object.keys(calculatedValues).length,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Calculator processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing calculations'
    });
  }
});

/**
 * @route   POST /api/calculator/validate
 * @desc    Validate calculation configuration for a form
 * @access  Private
 */
router.post('/validate', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.body;

    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const validation = CalculatorService.validateCalculations(form.fields);

    res.status(200).json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('Calculator validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating calculations'
    });
  }
});

export default router;