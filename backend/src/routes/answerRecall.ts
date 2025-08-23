import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Form from '../models/Form';
import AnswerRecallService from '../services/AnswerRecallService';
import ConditionalLogicService from '../services/ConditionalLogicService';

const router = express.Router();

// Answer recall processing validation
const validateAnswerRecall = [
  body('formId')
    .notEmpty()
    .withMessage('Form ID is required')
    .isMongoId()
    .withMessage('Invalid form ID format'),
  
  body('responses')
    .isObject()
    .withMessage('Responses must be an object'),
  
  body('fieldId')
    .optional()
    .isString()
    .withMessage('Field ID must be a string'),
];

// Template processing validation
const validateTemplate = [
  body('template')
    .notEmpty()
    .withMessage('Template is required')
    .isString()
    .withMessage('Template must be a string'),
  
  body('responses')
    .isObject()
    .withMessage('Responses must be an object'),
  
  body('fields')
    .optional()
    .isArray()
    .withMessage('Fields must be an array'),
];

/**
 * @route   POST /api/answer-recall/process
 * @desc    Process answer recall for form fields
 * @access  Public (for form rendering)
 */
router.post('/process', withValidation(validateAnswerRecall), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, responses, fieldId } = req.body;

    // Get form with fields
    const form = await Form.findById(formId).select('fields userId isPublic');
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    // Check if form is public or user has access
    if (!form.isPublic) {
      res.status(403).json({
        success: false,
        message: 'Form is not public'
      });
      return;
    }

    // Process answer recall for all fields or specific field
    let recalledValues: Record<string, any>;
    
    if (fieldId) {
      const targetField = form.fields.find(f => f.id === fieldId);
      if (!targetField) {
        res.status(404).json({
          success: false,
          message: 'Field not found'
        });
        return;
      }

      const recalledValue = AnswerRecallService.calculateRecalledValue(targetField, responses, form.fields);
      recalledValues = recalledValue !== null ? { [fieldId]: recalledValue } : {};
    } else {
      recalledValues = AnswerRecallService.processAnswerRecall(form.fields, responses);
    }

    // Get field dependencies for response optimization
    const dependencies: Record<string, string[]> = {};
    Object.keys(recalledValues).forEach(fieldId => {
      dependencies[fieldId] = AnswerRecallService.getFieldDependencies(fieldId, form.fields);
    });

    res.status(200).json({
      success: true,
      data: {
        recalledValues,
        dependencies,
        fieldCount: Object.keys(recalledValues).length,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Answer recall processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing answer recall'
    });
  }
});

/**
 * @route   POST /api/answer-recall/template
 * @desc    Process template with dynamic values
 * @access  Public
 */
router.post('/template', withValidation(validateTemplate), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { template, responses, fields = [] } = req.body;

    // Process the template
    const processedTemplate = AnswerRecallService.processTemplate(template, responses, fields);

    // Extract field references from template
    const fieldReferences = template.match(/\{\{([^}]+)\}\}/g) || [];
    const referencedFields = fieldReferences.map((ref: string) => 
      ref.replace(/\{\{|\}\}/g, '').trim()
    );

    // Detect used functions
    const functionPatterns = [
      /uppercase\(/g,
      /lowercase\(/g,
      /capitalize\(/g,
      /date_format\(/g,
      /join\(/g,
      /count\(/g,
      /sum\(/g
    ];

    const usedFunctions = functionPatterns.map((pattern, index) => {
      const functionNames = ['uppercase', 'lowercase', 'capitalize', 'date_format', 'join', 'count', 'sum'];
      return pattern.test(template) ? functionNames[index] : null;
    }).filter(Boolean);

    res.status(200).json({
      success: true,
      data: {
        originalTemplate: template,
        processedTemplate,
        referencedFields,
        usedFunctions,
        hasReferences: referencedFields.length > 0,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Template processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing template'
    });
  }
});

/**
 * @route   POST /api/answer-recall/validate
 * @desc    Validate answer recall configuration for a form
 * @access  Private
 */
router.post('/validate', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.body;

    if (!formId) {
      res.status(400).json({
        success: false,
        message: 'Form ID is required'
      });
      return;
    }

    // Get form and verify ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Validate answer recall configuration
    const validation = AnswerRecallService.validateAnswerRecall(form.fields);

    // Analyze answer recall usage
    const analysis = {
      totalFields: form.fields.length,
      fieldsWithAnswerRecall: 0,
      fieldsWithSourceField: 0,
      fieldsWithTemplate: 0,
      templatesWithFunctions: 0,
      fieldDependencies: new Map<string, string[]>()
    };

    form.fields.forEach(field => {
      if (field.answerRecall?.enabled) {
        analysis.fieldsWithAnswerRecall++;
        
        if (field.answerRecall.sourceFieldId) {
          analysis.fieldsWithSourceField++;
        }
        
        if (field.answerRecall.template) {
          analysis.fieldsWithTemplate++;
          
          // Check for functions in template
          const hasFunctions = /\w+\(/.test(field.answerRecall.template);
          if (hasFunctions) {
            analysis.templatesWithFunctions++;
          }
        }

        // Get dependencies for this field
        const dependencies = AnswerRecallService.getFieldDependencies(field.id, form.fields);
        if (dependencies.length > 0) {
          analysis.fieldDependencies.set(field.id, dependencies);
        }
      }
    });

    // Convert Map to object for JSON response
    const analysisResult = {
      ...analysis,
      fieldDependencies: Object.fromEntries(analysis.fieldDependencies)
    };

    res.status(200).json({
      success: true,
      data: {
        validation,
        analysis: analysisResult,
        recommendations: generateAnswerRecallRecommendations(analysisResult, validation)
      }
    });
  } catch (error: any) {
    console.error('Answer recall validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating answer recall'
    });
  }
});

/**
 * @route   GET /api/answer-recall/dependencies/:formId/:fieldId
 * @desc    Get field dependencies for answer recall
 * @access  Private
 */
router.get('/dependencies/:formId/:fieldId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, fieldId } = req.params;

    // Get form and verify ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Get dependencies for the specific field
    const dependencies = AnswerRecallService.getFieldDependencies(fieldId, form.fields);

    // Get detailed information about dependent fields
    const dependentFields = dependencies.map(depFieldId => {
      const field = form.fields.find(f => f.id === depFieldId);
      return {
        id: depFieldId,
        label: field?.label || 'Unknown',
        type: field?.type || 'unknown',
        answerRecall: field?.answerRecall || null
      };
    });

    // Check if the field itself has answer recall
    const targetField = form.fields.find(f => f.id === fieldId);
    const hasAnswerRecall = targetField?.answerRecall?.enabled || false;

    res.status(200).json({
      success: true,
      data: {
        fieldId,
        fieldLabel: targetField?.label || 'Unknown',
        hasAnswerRecall,
        dependenciesCount: dependencies.length,
        dependencies,
        dependentFields,
        affectedByChanges: dependencies.length > 0
      }
    });
  } catch (error: any) {
    console.error('Dependencies check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking field dependencies'
    });
  }
});

/**
 * @route   POST /api/answer-recall/simulate
 * @desc    Simulate answer recall with test responses
 * @access  Private
 */
router.post('/simulate', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, testResponses } = req.body;

    if (!formId || !testResponses) {
      res.status(400).json({
        success: false,
        message: 'Form ID and test responses are required'
      });
      return;
    }

    // Get form and verify ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Process answer recall with test responses
    const recalledValues = AnswerRecallService.processAnswerRecall(form.fields, testResponses);

    // Also process conditional logic to see the complete form state
    const conditionalLogic = ConditionalLogicService.evaluateFormLogic(form.fields, {
      ...testResponses,
      ...recalledValues
    });

    // Create detailed simulation result
    const simulation = {
      testResponses,
      recalledValues,
      finalValues: { ...testResponses, ...recalledValues },
      conditionalLogic: {
        visibleFields: Array.from(conditionalLogic.visibleFields),
        hiddenFields: Array.from(conditionalLogic.hiddenFields),
        skipTargets: Object.fromEntries(conditionalLogic.skipTargets)
      },
      fieldDetails: form.fields.map(field => ({
        id: field.id,
        label: field.label,
        type: field.type,
        hasAnswerRecall: field.answerRecall?.enabled || false,
        isVisible: conditionalLogic.visibleFields.has(field.id),
        originalValue: testResponses[field.id],
        recalledValue: recalledValues[field.id],
        finalValue: recalledValues[field.id] !== undefined ? recalledValues[field.id] : testResponses[field.id]
      }))
    };

    res.status(200).json({
      success: true,
      data: simulation
    });
  } catch (error: any) {
    console.error('Answer recall simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error simulating answer recall'
    });
  }
});

// Helper function to generate recommendations
function generateAnswerRecallRecommendations(analysis: any, validation: any): string[] {
  const recommendations: string[] = [];

  if (analysis.fieldsWithAnswerRecall === 0) {
    recommendations.push('Consider adding answer recall to improve user experience by auto-filling related fields');
  }

  if (validation.warnings.length > 0) {
    recommendations.push('Review forward references in answer recall - they may not work as expected');
  }

  if (analysis.fieldsWithTemplate > 0 && analysis.templatesWithFunctions === 0) {
    recommendations.push('Consider using template functions like capitalize(), uppercase(), or date_format() for better data formatting');
  }

  if (analysis.fieldsWithSourceField > analysis.fieldsWithTemplate) {
    recommendations.push('Templates offer more flexibility than simple source field references - consider upgrading to templates');
  }

  if (Object.keys(analysis.fieldDependencies).length > analysis.totalFields * 0.3) {
    recommendations.push('High number of field dependencies detected - ensure form performance remains optimal');
  }

  return recommendations;
}

export default router;