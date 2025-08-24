import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimiting';
import { withValidation } from '../middleware/validation';
import { body, param, query } from 'express-validator';
import FormBuilderService from '../services/FormBuilderService';
import Form from '../models/Form';

const router = express.Router();

// Validation middleware
const validateFormId = [
  param('formId')
    .isMongoId()
    .withMessage('Invalid form ID format'),
];

const validateFieldData = [
  body('type')
    .isIn(['text', 'textarea', 'email', 'number', 'date', 'dropdown', 'radio', 'checkbox', 'file'])
    .withMessage('Invalid field type'),
  
  body('label')
    .trim()
    .notEmpty()
    .withMessage('Field label is required')
    .isLength({ max: 200 })
    .withMessage('Field label cannot exceed 200 characters'),
  
  body('placeholder')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Placeholder cannot exceed 100 characters'),
  
  body('required')
    .optional()
    .isBoolean()
    .withMessage('Required must be boolean'),
  
  body('options')
    .optional()
    .isArray()
    .withMessage('Options must be an array'),
  
  body('options.*.value')
    .if(body('options').exists())
    .notEmpty()
    .withMessage('Option value is required'),
  
  body('options.*.label')
    .if(body('options').exists())
    .notEmpty()
    .withMessage('Option label is required'),
];

const validateFieldOrder = [
  body('fieldOrder')
    .isArray({ min: 1 })
    .withMessage('Field order must be a non-empty array'),
  
  body('fieldOrder.*')
    .isString()
    .withMessage('Field IDs must be strings'),
];

const validateConditionalLogic = [
  body('conditions')
    .isArray({ min: 1 })
    .withMessage('At least one condition is required'),
  
  body('conditions.*.fieldId')
    .notEmpty()
    .withMessage('Condition field ID is required'),
  
  body('conditions.*.operator')
    .isIn(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'])
    .withMessage('Invalid condition operator'),
  
  body('action')
    .isIn(['show', 'hide', 'require'])
    .withMessage('Invalid logic action'),
  
  body('operator')
    .optional()
    .isIn(['AND', 'OR'])
    .withMessage('Logic operator must be AND or OR'),
];

/**
 * @route   GET /api/form-builder/:formId
 * @desc    Get enhanced form builder data
 * @access  Private
 */
router.get('/:formId', protect, apiRateLimit, withValidation(validateFormId), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const userId = req.user!._id.toString();

    const builderData = await FormBuilderService.getFormBuilderData(formId, userId);

    res.status(200).json({
      success: true,
      data: builderData
    });
  } catch (error: any) {
    console.error('Get form builder data error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Error fetching form builder data'
    });
  }
});

/**
 * @route   POST /api/form-builder/:formId/fields
 * @desc    Add field to form
 * @access  Private
 */
router.post('/:formId/fields', protect, apiRateLimit, withValidation([...validateFormId, ...validateFieldData]), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const userId = req.user!._id.toString();
    const { position, ...fieldData } = req.body;

    const result = await FormBuilderService.addField(formId, userId, fieldData, position);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.field,
        message: result.message,
        totalFields: result.totalFields
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error: any) {
    console.error('Add field error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding field'
    });
  }
});

/**
 * @route   PUT /api/form-builder/:formId/fields/:fieldId
 * @desc    Update field configuration
 * @access  Private
 */
router.put('/:formId/fields/:fieldId', protect, apiRateLimit, withValidation(validateFormId), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, fieldId } = req.params;
    const userId = req.user!._id.toString();
    const updates = req.body;

    const result = await FormBuilderService.updateField(formId, userId, fieldId, updates);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.field,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error: any) {
    console.error('Update field error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating field'
    });
  }
});

/**
 * @route   DELETE /api/form-builder/:formId/fields/:fieldId
 * @desc    Delete field from form
 * @access  Private
 */
router.delete('/:formId/fields/:fieldId', protect, apiRateLimit, withValidation(validateFormId), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, fieldId } = req.params;
    const userId = req.user!._id.toString();

    const result = await FormBuilderService.deleteField(formId, userId, fieldId);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        totalFields: result.totalFields
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error: any) {
    console.error('Delete field error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting field'
    });
  }
});

/**
 * @route   PUT /api/form-builder/:formId/reorder
 * @desc    Reorder form fields
 * @access  Private
 */
router.put('/:formId/reorder', protect, apiRateLimit, withValidation([...validateFormId, ...validateFieldOrder]), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const userId = req.user!._id.toString();
    const { fieldOrder } = req.body;

    const result = await FormBuilderService.reorderFields(formId, userId, fieldOrder);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.fields,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error: any) {
    console.error('Reorder fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Error reordering fields'
    });
  }
});

/**
 * @route   POST /api/form-builder/:formId/fields/:fieldId/logic
 * @desc    Set conditional logic for a field
 * @access  Private
 */
router.post('/:formId/fields/:fieldId/logic', protect, apiRateLimit, withValidation([...validateFormId, ...validateConditionalLogic]), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, fieldId } = req.params;
    const userId = req.user!._id.toString();
    const logic = req.body;

    const result = await FormBuilderService.setConditionalLogic(formId, userId, fieldId, logic);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.field,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error: any) {
    console.error('Set conditional logic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting conditional logic'
    });
  }
});

/**
 * @route   DELETE /api/form-builder/:formId/fields/:fieldId/logic
 * @desc    Remove conditional logic from a field
 * @access  Private
 */
router.delete('/:formId/fields/:fieldId/logic', protect, apiRateLimit, withValidation(validateFormId), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, fieldId } = req.params;
    const userId = req.user!._id.toString();

    // Remove logic by setting empty conditions
    const result = await FormBuilderService.setConditionalLogic(formId, userId, fieldId, {
      conditions: [],
      action: 'show'
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.field,
        message: 'Conditional logic removed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error: any) {
    console.error('Remove conditional logic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing conditional logic'
    });
  }
});

/**
 * @route   GET /api/form-builder/field-types
 * @desc    Get available field types and their configurations
 * @access  Private
 */
router.get('/field-types', protect, apiRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const fieldTypes = [
      {
        type: 'text',
        label: 'Text Input',
        icon: 'type',
        category: 'input',
        description: 'Single line text input',
        validations: ['required', 'minLength', 'maxLength', 'pattern'],
        supportsLogic: true
      },
      {
        type: 'textarea',
        label: 'Text Area',
        icon: 'align-left',
        category: 'input',
        description: 'Multi-line text input',
        validations: ['required', 'minLength', 'maxLength'],
        supportsLogic: true
      },
      {
        type: 'email',
        label: 'Email',
        icon: 'mail',
        category: 'input',
        description: 'Email address input with validation',
        validations: ['required'],
        supportsLogic: true
      },
      {
        type: 'number',
        label: 'Number',
        icon: 'hash',
        category: 'input',
        description: 'Numeric input with optional range',
        validations: ['required', 'min', 'max'],
        supportsLogic: true
      },
      {
        type: 'date',
        label: 'Date',
        icon: 'calendar',
        category: 'input',
        description: 'Date picker input',
        validations: ['required', 'minDate', 'maxDate'],
        supportsLogic: true
      },
      {
        type: 'dropdown',
        label: 'Dropdown',
        icon: 'chevron-down',
        category: 'choice',
        description: 'Single selection from dropdown list',
        validations: ['required'],
        supportsLogic: true,
        requiresOptions: true
      },
      {
        type: 'radio',
        label: 'Radio Buttons',
        icon: 'circle',
        category: 'choice',
        description: 'Single selection from radio buttons',
        validations: ['required'],
        supportsLogic: true,
        requiresOptions: true
      },
      {
        type: 'checkbox',
        label: 'Checkboxes',
        icon: 'square',
        category: 'choice',
        description: 'Multiple selection checkboxes',
        validations: ['required', 'minSelected', 'maxSelected'],
        supportsLogic: true,
        requiresOptions: true
      },
      {
        type: 'file',
        label: 'File Upload',
        icon: 'upload',
        category: 'media',
        description: 'File upload with type restrictions',
        validations: ['required', 'fileType', 'maxSize'],
        supportsLogic: false
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        fieldTypes,
        categories: [
          { id: 'input', label: 'Input Fields', icon: 'edit' },
          { id: 'choice', label: 'Choice Fields', icon: 'list' },
          { id: 'media', label: 'Media Fields', icon: 'image' }
        ],
        operators: [
          { id: 'equals', label: 'Equals', description: 'Field value equals specified value' },
          { id: 'not_equals', label: 'Not Equals', description: 'Field value does not equal specified value' },
          { id: 'contains', label: 'Contains', description: 'Field value contains specified text' },
          { id: 'not_contains', label: 'Does Not Contain', description: 'Field value does not contain specified text' },
          { id: 'greater_than', label: 'Greater Than', description: 'Field value is greater than specified number' },
          { id: 'less_than', label: 'Less Than', description: 'Field value is less than specified number' },
          { id: 'is_empty', label: 'Is Empty', description: 'Field has no value' },
          { id: 'is_not_empty', label: 'Is Not Empty', description: 'Field has a value' }
        ],
        actions: [
          { id: 'show', label: 'Show Field', description: 'Show field when conditions are met' },
          { id: 'hide', label: 'Hide Field', description: 'Hide field when conditions are met' },
          { id: 'require', label: 'Make Required', description: 'Make field required when conditions are met' }
        ]
      }
    });
  } catch (error: any) {
    console.error('Get field types error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching field types'
    });
  }
});

/**
 * @route   POST /api/form-builder/:formId/duplicate
 * @desc    Duplicate an existing field
 * @access  Private
 */
router.post('/:formId/duplicate/:fieldId', protect, apiRateLimit, withValidation(validateFormId), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, fieldId } = req.params;
    const userId = req.user!._id.toString();

    // Get the form
    const form = await Form.findOne({ _id: formId, userId, isActive: true });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Find the field to duplicate
    const originalField = form.fields.find(f => f.id === fieldId);
    if (!originalField) {
      res.status(404).json({
        success: false,
        message: 'Field not found'
      });
      return;
    }

    // Create duplicate field data
    const duplicateData = {
      type: originalField.type,
      label: `${originalField.label} (Copy)`,
      placeholder: originalField.placeholder,
      required: originalField.required,
      options: originalField.options ? originalField.options.map(opt => ({ value: opt, label: opt })) : undefined,
      validation: originalField.validation,
      conditional: { 
        enabled: false,
        conditions: [],
        action: 'show' as const,
        operator: 'AND' as const
      }
    };

    const result = await FormBuilderService.addField(formId, userId, duplicateData);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.field,
        message: 'Field duplicated successfully',
        totalFields: result.totalFields
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error: any) {
    console.error('Duplicate field error:', error);
    res.status(500).json({
      success: false,
      message: 'Error duplicating field'
    });
  }
});

/**
 * @route   GET /api/form-builder/:formId/preview
 * @desc    Get form preview data
 * @access  Private
 */
router.get('/:formId/preview', protect, apiRateLimit, withValidation(validateFormId), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const userId = req.user!._id.toString();

    const form = await Form.findOne({ _id: formId, userId, isActive: true });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Generate preview data
    const previewData = {
      formId: form._id.toString(),
      title: form.title,
      description: form.description,
      fields: form.fields.map(field => ({
        id: field.id,
        type: field.type,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required,
        options: field.options,
        validation: field.validation,
        conditional: field.conditional
      })),
      customization: form.customization,
      settings: {
        showProgress: form.settings?.showProgressBar || false,
        allowMultiple: form.settings?.allowMultipleSubmissions || false
      },
      previewUrl: `${process.env.FRONTEND_URL}/preview/${form.publicUrl}`,
      publicUrl: `${process.env.FRONTEND_URL}/forms/${form.publicUrl}`
    };

    res.status(200).json({
      success: true,
      data: previewData
    });
  } catch (error: any) {
    console.error('Get form preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating form preview'
    });
  }
});

export default router;