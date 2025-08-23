import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';
import CustomThankYouPageService from '../services/CustomThankYouPageService';
import ConfettiAnimationService from '../services/ConfettiAnimationService';

const router = express.Router();

// Thank you page validation
const validateThankYouPage = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 2000 })
    .withMessage('Message cannot exceed 2000 characters'),
  
  body('redirectUrl')
    .optional()
    .isURL()
    .withMessage('Invalid redirect URL format'),
  
  body('redirectDelay')
    .optional()
    .isInt({ min: 0, max: 60 })
    .withMessage('Redirect delay must be between 0 and 60 seconds'),
  
  body('resetButtonText')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Reset button text cannot exceed 50 characters'),
  
  body('shareMessage')
    .optional()
    .isLength({ max: 280 })
    .withMessage('Share message cannot exceed 280 characters'),
  
  body('customCss')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('Custom CSS cannot exceed 10,000 characters'),
];

/**
 * @route   GET /api/thank-you-pages/form/:formId
 * @desc    Get thank you page configuration for a form
 * @access  Private
 */
router.get('/form/:formId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Get thank you page configuration
    let thankYouPage = form.customization?.thankYouPage;
    
    if (!thankYouPage) {
      // Create default configuration
      thankYouPage = CustomThankYouPageService.createDefaultThankYouPage(formId);
      
      // Save default configuration to form
      if (!form.customization) {
        form.customization = {
          primaryColor: '#3182ce',
          fontFamily: 'Inter, sans-serif',
          backgroundColor: '#ffffff',
          theme: 'default' as const
        };
      }
      form.customization.thankYouPage = thankYouPage;
      await form.save();
    }

    res.status(200).json({
      success: true,
      data: thankYouPage
    });
  } catch (error: any) {
    console.error('Get thank you page error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching thank you page configuration'
    });
  }
});

/**
 * @route   PUT /api/thank-you-pages/form/:formId
 * @desc    Update thank you page configuration for a form
 * @access  Private
 */
router.put('/form/:formId', protect, withValidation(validateThankYouPage), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const updateData = req.body;

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
    const validation = CustomThankYouPageService.validateThankYouPage(updateData);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid thank you page configuration',
        errors: validation.errors,
        warnings: validation.warnings
      });
      return;
    }

    // Get existing configuration or create default
    let thankYouPage = form.customization?.thankYouPage || 
                      CustomThankYouPageService.createDefaultThankYouPage(formId);

    // Update configuration
    thankYouPage = {
      ...thankYouPage,
      ...updateData,
      updatedAt: new Date()
    };

    // Save to form
    if (!form.customization) {
      form.customization = {
        primaryColor: '#3182ce',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#ffffff',
        theme: 'default' as const
      };
    }
    form.customization.thankYouPage = thankYouPage;
    await form.save();

    res.status(200).json({
      success: true,
      data: thankYouPage,
      validation: {
        warnings: validation.warnings
      }
    });
  } catch (error: any) {
    console.error('Update thank you page error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating thank you page configuration'
    });
  }
});

/**
 * @route   POST /api/thank-you-pages/form/:formId/preview
 * @desc    Generate preview of thank you page
 * @access  Private
 */
router.post('/form/:formId/preview', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const previewConfig = req.body;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Use provided config or get from form
    const thankYouPageConfig = previewConfig || 
                              form.customization?.thankYouPage || 
                              CustomThankYouPageService.createDefaultThankYouPage(formId);

    // Generate preview
    const preview = CustomThankYouPageService.createPreview(thankYouPageConfig);

    res.status(200).json({
      success: true,
      data: preview
    });
  } catch (error: any) {
    console.error('Generate preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating thank you page preview'
    });
  }
});

/**
 * @route   GET /api/thank-you-pages/render/:formId/:responseId
 * @desc    Render thank you page for a specific form response
 * @access  Public
 */
router.get('/render/:formId/:responseId', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, responseId } = req.params;

    // Get form and response
    const [form, formResponse] = await Promise.all([
      Form.findById(formId).select('title description customization isPublic'),
      FormResponse.findById(responseId).select('responses submittedAt metadata')
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

    // Get thank you page configuration
    let thankYouPage = form.customization?.thankYouPage;
    if (!thankYouPage || !thankYouPage.isEnabled) {
      // Return default thank you page
      res.status(200).json({
        success: true,
        data: {
          title: 'Thank you!',
          message: 'Your response has been recorded.',
          submissionId: responseId,
          isDefault: true
        }
      });
      return;
    }

    // Process dynamic content
    const processedConfig = CustomThankYouPageService.processThankYouPageContent(
      thankYouPage,
      formResponse,
      form
    );

    // Add submission ID to custom data
    processedConfig.customData = {
      ...processedConfig.customData,
      submissionId: responseId
    };

    // Track analytics
    const updatedAnalytics = CustomThankYouPageService.trackAnalytics(processedConfig, 'view');
    
    // Update analytics in database (fire and forget)
    Form.findByIdAndUpdate(
      formId,
      { 'customization.thankYouPage.analytics': updatedAnalytics },
      { new: false }
    ).catch(err => console.error('Analytics update error:', err));

    // Generate share URLs and reset URL
    const formUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/form/${formId}`;
    const shareUrls = CustomThankYouPageService.generateShareUrls(processedConfig, formUrl);
    const resetUrl = processedConfig.showResetButton ? 
                    CustomThankYouPageService.generateResetUrl(formUrl, responseId) : 
                    undefined;

    // Generate confetti HTML if enabled
    let confettiHtml = '';
    if (form.customization?.confetti?.enabled) {
      const confettiTrigger = ConfettiAnimationService.createSubmissionConfetti(
        form,
        formResponse,
        form.customization.confetti.config
      );
      confettiHtml = ConfettiAnimationService.generateConfettiHtml(confettiTrigger.config, true);
    }

    // Generate HTML
    const html = CustomThankYouPageService.generateThankYouPageHtml(
      processedConfig,
      shareUrls,
      resetUrl,
      confettiHtml
    );

    res.status(200).json({
      success: true,
      data: {
        config: processedConfig,
        html,
        shareUrls,
        resetUrl
      }
    });
  } catch (error: any) {
    console.error('Render thank you page error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rendering thank you page'
    });
  }
});

/**
 * @route   POST /api/thank-you-pages/track/:formId/:action
 * @desc    Track analytics for thank you page actions
 * @access  Public
 */
router.post('/track/:formId/:action', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, action } = req.params;

    if (!['view', 'share', 'reset'].includes(action)) {
      res.status(400).json({
        success: false,
        message: 'Invalid action. Must be view, share, or reset'
      });
      return;
    }

    // Get form
    const form = await Form.findById(formId).select('customization.thankYouPage');
    if (!form || !form.customization?.thankYouPage) {
      res.status(404).json({
        success: false,
        message: 'Thank you page configuration not found'
      });
      return;
    }

    // Update analytics
    const updatedAnalytics = CustomThankYouPageService.trackAnalytics(
      form.customization.thankYouPage,
      action as 'view' | 'share' | 'reset'
    );

    // Save to database
    await Form.findByIdAndUpdate(
      formId,
      { 'customization.thankYouPage.analytics': updatedAnalytics }
    );

    res.status(200).json({
      success: true,
      data: {
        action,
        analytics: updatedAnalytics
      }
    });
  } catch (error: any) {
    console.error('Track analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking analytics'
    });
  }
});

/**
 * @route   POST /api/thank-you-pages/validate
 * @desc    Validate thank you page configuration
 * @access  Private
 */
router.post('/validate', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const config = req.body;

    const validation = CustomThankYouPageService.validateThankYouPage(config);

    res.status(200).json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('Validate thank you page error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating thank you page configuration'
    });
  }
});

/**
 * @route   DELETE /api/thank-you-pages/form/:formId
 * @desc    Reset thank you page to default configuration
 * @access  Private
 */
router.delete('/form/:formId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Reset to default configuration
    const defaultConfig = CustomThankYouPageService.createDefaultThankYouPage(formId);
    
    if (!form.customization) {
      form.customization = {
        primaryColor: '#3182ce',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#ffffff',
        theme: 'default' as const
      };
    }
    form.customization.thankYouPage = defaultConfig;
    await form.save();

    res.status(200).json({
      success: true,
      data: defaultConfig,
      message: 'Thank you page reset to default configuration'
    });
  } catch (error: any) {
    console.error('Reset thank you page error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting thank you page configuration'
    });
  }
});

export default router;