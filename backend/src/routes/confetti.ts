import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';
import ConfettiAnimationService, { IConfettiConfig } from '../services/ConfettiAnimationService';

const router = express.Router();

// Confetti configuration validation
const validateConfettiConfig = [
  body('particleCount')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Particle count must be between 1 and 500'),
  
  body('spread')
    .optional()
    .isInt({ min: 0, max: 360 })
    .withMessage('Spread must be between 0 and 360 degrees'),
  
  body('duration')
    .optional()
    .isInt({ min: 100, max: 10000 })
    .withMessage('Duration must be between 100 and 10000 milliseconds'),
  
  body('colors')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Colors must be an array with at least one color'),
  
  body('scalar')
    .optional()
    .isFloat({ min: 0.1, max: 3.0 })
    .withMessage('Scalar must be between 0.1 and 3.0'),
  
  body('gravity')
    .optional()
    .isFloat({ min: 0.1, max: 5.0 })
    .withMessage('Gravity must be between 0.1 and 5.0'),
];

/**
 * @route   GET /api/confetti/presets
 * @desc    Get available confetti presets
 * @access  Public
 */
router.get('/presets', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const presets = ConfettiAnimationService.getAvailablePresets();

    res.status(200).json({
      success: true,
      data: presets
    });
  } catch (error: any) {
    console.error('Get confetti presets error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching confetti presets'
    });
  }
});

/**
 * @route   POST /api/confetti/generate-config
 * @desc    Generate confetti configuration for a form
 * @access  Private
 */
router.post('/generate-config', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, customConfig } = req.body;

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

    // Generate confetti configuration
    const config = ConfettiAnimationService.generateConfettiConfig(form, customConfig);

    res.status(200).json({
      success: true,
      data: {
        config,
        script: ConfettiAnimationService.generateConfettiScript(config),
        html: ConfettiAnimationService.generateConfettiHtml(config, false)
      }
    });
  } catch (error: any) {
    console.error('Generate confetti config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating confetti configuration'
    });
  }
});

/**
 * @route   POST /api/confetti/validate-config
 * @desc    Validate confetti configuration
 * @access  Private
 */
router.post('/validate-config', protect, withValidation(validateConfettiConfig), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const config = req.body;

    const validation = ConfettiAnimationService.validateConfettiConfig(config);

    res.status(200).json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('Validate confetti config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating confetti configuration'
    });
  }
});

/**
 * @route   POST /api/confetti/form/:formId/enable
 * @desc    Enable confetti animation for a form
 * @access  Private
 */
router.post('/form/:formId/enable', protect, withValidation(validateConfettiConfig), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const confettiConfig = req.body;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Validate configuration
    const validation = ConfettiAnimationService.validateConfettiConfig(confettiConfig);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid confetti configuration',
        errors: validation.errors,
        warnings: validation.warnings
      });
      return;
    }

    // Generate final configuration
    const finalConfig = ConfettiAnimationService.generateConfettiConfig(form, confettiConfig);

    // Update form with confetti settings
    if (!form.customization) {
      form.customization = {
        primaryColor: '#3182ce',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#ffffff',
        theme: 'default' as const
      };
    }

    form.customization.confetti = {
      enabled: true,
      config: finalConfig,
      updatedAt: new Date()
    };

    await form.save();

    res.status(200).json({
      success: true,
      data: {
        enabled: true,
        config: finalConfig,
        warnings: validation.warnings
      }
    });
  } catch (error: any) {
    console.error('Enable confetti error:', error);
    res.status(500).json({
      success: false,
      message: 'Error enabling confetti animation'
    });
  }
});

/**
 * @route   POST /api/confetti/form/:formId/disable
 * @desc    Disable confetti animation for a form
 * @access  Private
 */
router.post('/form/:formId/disable', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Update form to disable confetti
    if (form.customization?.confetti) {
      form.customization.confetti.enabled = false;
      form.customization.confetti.updatedAt = new Date();
      await form.save();
    }

    res.status(200).json({
      success: true,
      data: {
        enabled: false,
        message: 'Confetti animation disabled'
      }
    });
  } catch (error: any) {
    console.error('Disable confetti error:', error);
    res.status(500).json({
      success: false,
      message: 'Error disabling confetti animation'
    });
  }
});

/**
 * @route   GET /api/confetti/form/:formId/config
 * @desc    Get confetti configuration for a form
 * @access  Private
 */
router.get('/form/:formId/config', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const confettiSettings = form.customization?.confetti;
    
    if (!confettiSettings) {
      // Generate default configuration
      const defaultConfig = ConfettiAnimationService.generateConfettiConfig(form);
      
      res.status(200).json({
        success: true,
        data: {
          enabled: false,
          config: defaultConfig,
          isDefault: true
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        enabled: confettiSettings.enabled,
        config: confettiSettings.config,
        updatedAt: confettiSettings.updatedAt,
        isDefault: false
      }
    });
  } catch (error: any) {
    console.error('Get confetti config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching confetti configuration'
    });
  }
});

/**
 * @route   POST /api/confetti/trigger/:formId/:responseId
 * @desc    Generate confetti trigger for a specific form response
 * @access  Public (for form rendering)
 */
router.post('/trigger/:formId/:responseId', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, responseId } = req.params;
    const { customConfig } = req.body;

    // Get form and response
    const [form, formResponse] = await Promise.all([
      Form.findById(formId).select('title description customization isPublic'),
      FormResponse.findById(responseId).select('responses submittedAt isValid')
    ]);

    if (!form || !form.isPublic) {
      res.status(404).json({
        success: false,
        message: 'Form not found or not public'
      });
      return;
    }

    if (!formResponse) {
      res.status(404).json({
        success: false,
        message: 'Form response not found'
      });
      return;
    }

    // Check if confetti is enabled for this form
    const confettiEnabled = form.customization?.confetti?.enabled;
    if (!confettiEnabled) {
      res.status(200).json({
        success: true,
        data: {
          enabled: false,
          message: 'Confetti animation is not enabled for this form'
        }
      });
      return;
    }

    // Generate confetti trigger
    const confettiTrigger = ConfettiAnimationService.createSubmissionConfetti(
      form,
      formResponse,
      customConfig
    );

    // Generate script and HTML
    const script = ConfettiAnimationService.generateConfettiScript(confettiTrigger.config);
    const html = ConfettiAnimationService.generateConfettiHtml(confettiTrigger.config, true);

    res.status(200).json({
      success: true,
      data: {
        enabled: true,
        trigger: confettiTrigger,
        script,
        html,
        formTitle: form.title
      }
    });
  } catch (error: any) {
    console.error('Generate confetti trigger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating confetti trigger'
    });
  }
});

/**
 * @route   POST /api/confetti/test/:formId
 * @desc    Test confetti animation for a form
 * @access  Private
 */
router.post('/test/:formId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { preset, customConfig } = req.body;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Generate test configuration
    let testConfig: IConfettiConfig;
    
    if (preset) {
      // Use preset configuration
      const presets = ConfettiAnimationService.getAvailablePresets();
      const presetData = presets.find(p => p.name === preset);
      
      if (!presetData) {
        res.status(400).json({
          success: false,
          message: 'Invalid preset name'
        });
        return;
      }
      
      testConfig = ConfettiAnimationService.generateConfettiConfig(form, presetData.config);
    } else {
      // Use custom configuration or form default
      testConfig = ConfettiAnimationService.generateConfettiConfig(form, customConfig);
    }

    // Generate script for testing
    const script = ConfettiAnimationService.generateConfettiScript(testConfig);
    const html = ConfettiAnimationService.generateConfettiHtml(testConfig, true);

    res.status(200).json({
      success: true,
      data: {
        config: testConfig,
        script,
        html,
        preset: preset || 'custom',
        formTitle: form.title
      }
    });
  } catch (error: any) {
    console.error('Test confetti error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing confetti animation'
    });
  }
});

export default router;