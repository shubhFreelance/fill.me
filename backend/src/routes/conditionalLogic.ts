import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Form from '../models/Form';
import ConditionalLogicService from '../services/ConditionalLogicService';

const router = express.Router();

// Conditional logic evaluation validation
const validateLogicEvaluation = [
  body('formId')
    .notEmpty()
    .withMessage('Form ID is required')
    .isMongoId()
    .withMessage('Invalid form ID format'),
  
  body('responses')
    .isObject()
    .withMessage('Responses must be an object'),
  
  body('currentFieldId')
    .optional()
    .isString()
    .withMessage('Current field ID must be a string'),
];

// Logic validation request
const validateLogicValidation = [
  body('formId')
    .notEmpty()
    .withMessage('Form ID is required')
    .isMongoId()
    .withMessage('Invalid form ID format'),
];

// Logic simulation validation
const validateLogicSimulation = [
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
 * @route   POST /api/conditional-logic/evaluate
 * @desc    Evaluate conditional logic for form fields
 * @access  Public (for form rendering)
 */
router.post('/evaluate', withValidation(validateLogicEvaluation), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, responses, currentFieldId } = req.body;

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

    // Evaluate conditional logic
    const logicResult = ConditionalLogicService.evaluateFormLogic(form.fields, responses);

    // Get next visible fields if current field is provided
    let nextFields: string[] = [];
    if (currentFieldId) {
      nextFields = ConditionalLogicService.getNextVisibleFields(form.fields, responses, currentFieldId);
    }

    // Convert Sets and Maps to arrays/objects for JSON response
    const responseData = {
      visibleFields: Array.from(logicResult.visibleFields),
      hiddenFields: Array.from(logicResult.hiddenFields),
      skipTargets: Object.fromEntries(logicResult.skipTargets),
      fieldStates: Object.fromEntries(logicResult.fieldStates),
      nextFields,
      totalFields: form.fields.length,
      evaluationTimestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error: any) {
    console.error('Conditional logic evaluation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error evaluating conditional logic'
    });
  }
});

/**
 * @route   POST /api/conditional-logic/validate
 * @desc    Validate conditional logic configuration for a form
 * @access  Private
 */
router.post('/validate', protect, withValidation(validateLogicValidation), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.body;

    // Get form and verify ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Validate conditional logic
    const validation = ConditionalLogicService.validateConditionalLogic(form.fields);

    res.status(200).json({
      success: true,
      data: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        fieldCount: form.fields.length,
        fieldsWithLogic: form.fields.filter(f => 
          f.conditional?.show?.enabled || f.conditional?.skip?.enabled
        ).length
      }
    });
  } catch (error: any) {
    console.error('Conditional logic validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating conditional logic'
    });
  }
});

/**
 * @route   POST /api/conditional-logic/simulate
 * @desc    Simulate form flow with given responses
 * @access  Private
 */
router.post('/simulate', protect, withValidation(validateLogicSimulation), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, responses } = req.body;

    // Get form and verify ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Simulate form flow
    const simulation = ConditionalLogicService.simulateFormFlow(form.fields, responses);

    // Add field details to the flow path
    const flowPathWithDetails = simulation.flowPath.map(fieldId => {
      const field = form.fields.find(f => f.id === fieldId);
      return {
        fieldId,
        label: field?.label || 'Unknown',
        type: field?.type || 'unknown',
        order: field?.order || 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        ...simulation,
        flowPathWithDetails,
        simulationSummary: {
          totalFields: form.fields.length,
          visibleFieldsCount: simulation.visibleFields.length,
          hiddenFieldsCount: simulation.hiddenFields.length,
          skipActionsCount: simulation.skipActions.length,
          flowPathLength: simulation.flowPath.length
        }
      }
    });
  } catch (error: any) {
    console.error('Conditional logic simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error simulating conditional logic'
    });
  }
});

/**
 * @route   GET /api/conditional-logic/form/:formId/analysis
 * @desc    Get detailed analysis of form's conditional logic
 * @access  Private
 */
router.get('/form/:formId/analysis', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;

    // Get form and verify ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Analyze conditional logic
    const validation = ConditionalLogicService.validateConditionalLogic(form.fields);

    // Count logic usage
    const logicAnalysis = {
      totalFields: form.fields.length,
      fieldsWithShowLogic: 0,
      fieldsWithSkipLogic: 0,
      totalShowConditions: 0,
      totalSkipConditions: 0,
      referencedFields: new Set<string>(),
      targetFields: new Set<string>(),
      complexityScore: 0
    };

    form.fields.forEach(field => {
      if (field.conditional?.show?.enabled && field.conditional.show.conditions?.length) {
        logicAnalysis.fieldsWithShowLogic++;
        logicAnalysis.totalShowConditions += field.conditional.show.conditions.length;
        field.conditional.show.conditions.forEach(condition => {
          logicAnalysis.referencedFields.add(condition.fieldId);
        });
      }

      if (field.conditional?.skip?.enabled && field.conditional.skip.conditions?.length) {
        logicAnalysis.fieldsWithSkipLogic++;
        logicAnalysis.totalSkipConditions += field.conditional.skip.conditions.length;
        field.conditional.skip.conditions.forEach(condition => {
          logicAnalysis.referencedFields.add(condition.fieldId);
        });
        
        if (field.conditional.skip.targetFieldId) {
          logicAnalysis.targetFields.add(field.conditional.skip.targetFieldId);
        }
      }
    });

    // Calculate complexity score
    logicAnalysis.complexityScore = 
      (logicAnalysis.fieldsWithShowLogic * 2) +
      (logicAnalysis.fieldsWithSkipLogic * 3) +
      (logicAnalysis.totalShowConditions) +
      (logicAnalysis.totalSkipConditions * 2);

    // Convert Sets to arrays for JSON response
    const analysisResult = {
      ...logicAnalysis,
      referencedFields: Array.from(logicAnalysis.referencedFields),
      targetFields: Array.from(logicAnalysis.targetFields),
      validation: validation,
      recommendations: generateRecommendations(logicAnalysis, validation)
    };

    res.status(200).json({
      success: true,
      data: analysisResult
    });
  } catch (error: any) {
    console.error('Conditional logic analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing conditional logic'
    });
  }
});

/**
 * @route   POST /api/conditional-logic/test-conditions
 * @desc    Test specific conditions with sample data
 * @access  Private
 */
router.post('/test-conditions', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { conditions, testValues, fieldType = 'text' } = req.body;

    if (!Array.isArray(conditions) || !testValues) {
      res.status(400).json({
        success: false,
        message: 'Invalid input: conditions must be an array and testValues must be provided'
      });
      return;
    }

    const results = testValues.map((testValue: any) => {
      const mockResponses = { testField: testValue };
      const mockFields = [{ id: 'testField', type: fieldType }];
      
      const result = ConditionalLogicService.evaluateConditions(
        conditions.map(c => ({ ...c, fieldId: 'testField' })),
        mockResponses,
        mockFields as any
      );

      return {
        testValue,
        result,
        conditions: conditions.map(condition => ({
          ...condition,
          individualResult: ConditionalLogicService.evaluateSingleCondition(
            { ...condition, fieldId: 'testField' },
            mockResponses,
            mockFields as any
          )
        }))
      };
    });

    res.status(200).json({
      success: true,
      data: {
        testResults: results,
        summary: {
          totalTests: testValues.length,
          passedTests: results.filter((r: any) => r.result).length,
          failedTests: results.filter((r: any) => !r.result).length
        }
      }
    });
  } catch (error: any) {
    console.error('Condition testing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing conditions'
    });
  }
});

// Helper function to generate recommendations
function generateRecommendations(analysis: any, validation: any): string[] {
  const recommendations: string[] = [];

  if (analysis.complexityScore > 20) {
    recommendations.push('Consider simplifying conditional logic to improve form performance and user experience');
  }

  if (validation.warnings.length > 0) {
    recommendations.push('Review forward references in conditions as they may cause unexpected behavior');
  }

  if (analysis.fieldsWithSkipLogic > analysis.totalFields * 0.5) {
    recommendations.push('High number of skip conditions detected - consider restructuring form flow');
  }

  if (analysis.referencedFields.length < analysis.totalFields * 0.3) {
    recommendations.push('Consider adding more conditional logic to create a more dynamic user experience');
  }

  if (analysis.fieldsWithShowLogic === 0 && analysis.fieldsWithSkipLogic === 0) {
    recommendations.push('No conditional logic configured - consider adding conditions to improve form relevance');
  }

  return recommendations;
}

export default router;