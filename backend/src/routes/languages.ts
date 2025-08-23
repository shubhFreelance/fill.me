import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body, query } from 'express-validator';
import Form from '../models/Form';
import MultiLanguageService, { ILanguageInfo } from '../services/MultiLanguageService';

const router = express.Router();

// Language validation
const validateLanguageSettings = [
  body('default')
    .notEmpty()
    .withMessage('Default language is required')
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be 2-5 characters'),
  
  body('supported')
    .isArray({ min: 1 })
    .withMessage('At least one supported language is required'),
  
  body('supported.*.code')
    .notEmpty()
    .withMessage('Language code is required')
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be 2-5 characters'),
  
  body('supported.*.name')
    .notEmpty()
    .withMessage('Language name is required')
    .isLength({ max: 100 })
    .withMessage('Language name cannot exceed 100 characters'),
  
  body('fallbackLanguage')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Fallback language code must be 2-5 characters'),
];

const validateAddLanguage = [
  body('languageCode')
    .notEmpty()
    .withMessage('Language code is required')
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be 2-5 characters'),
  
  body('customTranslations')
    .optional()
    .isObject()
    .withMessage('Custom translations must be an object'),
];

const validateTranslations = [
  body('languageCode')
    .notEmpty()
    .withMessage('Language code is required'),
  
  body('translations')
    .isObject()
    .withMessage('Translations must be an object'),
];

/**
 * @route   GET /api/languages/supported
 * @desc    Get list of all supported language codes and info
 * @access  Public
 */
router.get('/supported', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const supportedLanguages = MultiLanguageService.getSupportedLanguages();

    res.status(200).json({
      success: true,
      data: supportedLanguages,
      count: supportedLanguages.length
    });
  } catch (error: any) {
    console.error('Get supported languages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching supported languages'
    });
  }
});

/**
 * @route   GET /api/languages/info/:code
 * @desc    Get information about a specific language
 * @access  Public
 */
router.get('/info/:code', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;
    const languageInfo = MultiLanguageService.getLanguageInfo(code);

    if (!languageInfo) {
      res.status(404).json({
        success: false,
        message: 'Language not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: languageInfo
    });
  } catch (error: any) {
    console.error('Get language info error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching language information'
    });
  }
});

/**
 * @route   POST /api/languages/detect
 * @desc    Auto-detect user language from Accept-Language header
 * @access  Public
 */
router.post('/detect', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { supportedLanguages } = req.body;
    const acceptLanguage = req.headers['accept-language'] as string;

    if (!supportedLanguages || !Array.isArray(supportedLanguages)) {
      res.status(400).json({
        success: false,
        message: 'Supported languages array is required'
      });
      return;
    }

    const detectedLanguage = MultiLanguageService.detectUserLanguage(
      acceptLanguage || '',
      supportedLanguages
    );

    res.status(200).json({
      success: true,
      data: {
        detectedLanguage,
        acceptLanguageHeader: acceptLanguage,
        supportedLanguages
      }
    });
  } catch (error: any) {
    console.error('Language detection error:', error);
    res.status(500).json({
      success: false,
      message: 'Error detecting user language'
    });
  }
});

/**
 * @route   GET /api/languages/form/:formId
 * @desc    Get language settings for a form
 * @access  Private/Public (based on form visibility)
 */
router.get('/form/:formId', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { lang } = req.query;

    const form = await Form.findById(formId).select('title description languages isPublic userId');
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    // For private forms, check ownership
    if (!form.isPublic && req.headers.authorization) {
      // This would need proper auth middleware check
      // For now, we'll allow if form exists
    }

    // Get language settings or initialize default
    let languageSettings = form.languages;
    if (!languageSettings) {
      languageSettings = MultiLanguageService.initializeLanguageSettings();
    }

    // If specific language requested, return localized form
    if (lang && typeof lang === 'string') {
      const fullForm = await Form.findById(formId);
      if (fullForm) {
        const localizedForm = MultiLanguageService.localizeForm(fullForm, lang);
        
        res.status(200).json({
          success: true,
          data: {
            languageSettings,
            localizedForm,
            requestedLanguage: lang
          }
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      data: languageSettings
    });
  } catch (error: any) {
    console.error('Get form languages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form language settings'
    });
  }
});

/**
 * @route   PUT /api/languages/form/:formId
 * @desc    Update language settings for a form
 * @access  Private
 */
router.put('/form/:formId', protect, withValidation(validateLanguageSettings), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const languageSettings = req.body;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Validate language settings
    const validation = MultiLanguageService.validateLanguageSettings(languageSettings);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid language settings',
        errors: validation.errors,
        warnings: validation.warnings
      });
      return;
    }

    // Update form with language settings
    form.languages = languageSettings;
    await form.save();

    res.status(200).json({
      success: true,
      data: form.languages,
      validation: {
        warnings: validation.warnings
      }
    });
  } catch (error: any) {
    console.error('Update form languages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating form language settings'
    });
  }
});

/**
 * @route   POST /api/languages/form/:formId/add-language
 * @desc    Add language support to a form
 * @access  Private
 */
router.post('/form/:formId/add-language', protect, withValidation(validateAddLanguage), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { languageCode, customTranslations } = req.body;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Initialize language settings if not present
    if (!form.languages) {
      form.languages = MultiLanguageService.initializeLanguageSettings();
    }

    try {
      // Add language support
      form.languages = MultiLanguageService.addLanguageSupport(
        form.languages,
        languageCode,
        customTranslations
      );

      await form.save();

      res.status(200).json({
        success: true,
        data: {
          languageCode,
          addedLanguage: form.languages.supported.find(lang => lang.code === languageCode),
          totalLanguages: form.languages.supported.length
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  } catch (error: any) {
    console.error('Add language error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding language support'
    });
  }
});

/**
 * @route   DELETE /api/languages/form/:formId/remove-language/:languageCode
 * @desc    Remove language support from a form
 * @access  Private
 */
router.delete('/form/:formId/remove-language/:languageCode', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, languageCode } = req.params;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    if (!form.languages) {
      res.status(400).json({
        success: false,
        message: 'No language settings found for this form'
      });
      return;
    }

    try {
      // Remove language support
      form.languages = MultiLanguageService.removeLanguageSupport(
        form.languages,
        languageCode
      );

      await form.save();

      res.status(200).json({
        success: true,
        data: {
          removedLanguage: languageCode,
          remainingLanguages: form.languages.supported.map(lang => lang.code)
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  } catch (error: any) {
    console.error('Remove language error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing language support'
    });
  }
});

/**
 * @route   PUT /api/languages/form/:formId/translations
 * @desc    Update translations for a specific language
 * @access  Private
 */
router.put('/form/:formId/translations', protect, withValidation(validateTranslations), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { languageCode, translations } = req.body;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    if (!form.languages) {
      res.status(400).json({
        success: false,
        message: 'No language settings found for this form'
      });
      return;
    }

    // Update translations
    form.languages = MultiLanguageService.updateTranslations(
      form.languages,
      languageCode,
      translations
    );

    await form.save();

    const updatedTranslations = MultiLanguageService.getTranslations(form.languages, languageCode);

    res.status(200).json({
      success: true,
      data: {
        languageCode,
        translations: updatedTranslations,
        updatedKeys: Object.keys(translations)
      }
    });
  } catch (error: any) {
    console.error('Update translations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating translations'
    });
  }
});

/**
 * @route   GET /api/languages/form/:formId/translations/:languageCode
 * @desc    Get translations for a specific language
 * @access  Private
 */
router.get('/form/:formId/translations/:languageCode', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, languageCode } = req.params;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    if (!form.languages) {
      res.status(404).json({
        success: false,
        message: 'No language settings found for this form'
      });
      return;
    }

    const translations = MultiLanguageService.getTranslations(form.languages, languageCode);
    if (!translations) {
      res.status(404).json({
        success: false,
        message: 'Language not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        languageCode,
        translations,
        translationCount: Object.keys(translations).length
      }
    });
  } catch (error: any) {
    console.error('Get translations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching translations'
    });
  }
});

/**
 * @route   GET /api/languages/form/:formId/localize/:languageCode
 * @desc    Get localized form for a specific language
 * @access  Public (for form rendering)
 */
router.get('/form/:formId/localize/:languageCode', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, languageCode } = req.params;

    const form = await Form.findById(formId);
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

    const localizedForm = MultiLanguageService.localizeForm(form, languageCode);

    res.status(200).json({
      success: true,
      data: localizedForm
    });
  } catch (error: any) {
    console.error('Localize form error:', error);
    res.status(500).json({
      success: false,
      message: 'Error localizing form'
    });
  }
});

/**
 * @route   GET /api/languages/form/:formId/translation-keys
 * @desc    Get all translation keys for a form
 * @access  Private
 */
router.get('/form/:formId/translation-keys', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const translationKeys = MultiLanguageService.generateTranslationKeys(form);

    res.status(200).json({
      success: true,
      data: {
        keys: translationKeys,
        count: translationKeys.length,
        formTitle: form.title
      }
    });
  } catch (error: any) {
    console.error('Get translation keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching translation keys'
    });
  }
});

/**
 * @route   GET /api/languages/form/:formId/export
 * @desc    Export translations for a form
 * @access  Private
 */
router.get('/form/:formId/export', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { format = 'json' } = req.query as { format?: 'json' | 'csv' | 'xlsx' };

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    if (!form.languages) {
      res.status(404).json({
        success: false,
        message: 'No language settings found for this form'
      });
      return;
    }

    const exportData = MultiLanguageService.exportTranslations(form.languages, format);

    // Set appropriate headers based on format
    switch (format) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="translations-${formId}.json"`);
        break;
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="translations-${formId}.csv"`);
        break;
      default:
        res.setHeader('Content-Type', 'application/json');
    }

    if (format === 'json') {
      res.status(200).json({
        success: true,
        data: exportData
      });
    } else {
      res.status(200).send(exportData);
    }
  } catch (error: any) {
    console.error('Export translations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting translations'
    });
  }
});

export default router;