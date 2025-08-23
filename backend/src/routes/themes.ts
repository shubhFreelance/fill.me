import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import ThemeService from '../services/ThemeService';

const router = express.Router();

/**
 * @route   GET /api/themes
 * @desc    Get all available themes
 * @access  Public
 */
router.get('/', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const themes = Object.entries(ThemeService.PREDEFINED_THEMES).map(([key, theme]) => ({
      id: key,
      ...theme
    }));

    res.status(200).json({
      success: true,
      data: {
        themes,
        fontFamilies: ThemeService.FONT_FAMILIES,
        colorPalettes: ThemeService.COLOR_PALETTES
      }
    });
  } catch (error: any) {
    console.error('Get themes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching themes'
    });
  }
});

/**
 * @route   POST /api/themes/apply
 * @desc    Apply theme to customization
 * @access  Public
 */
router.post('/apply', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { themeName, existingCustomization } = req.body;

    if (!themeName) {
      res.status(400).json({
        success: false,
        message: 'Theme name is required'
      });
      return;
    }

    const customization = ThemeService.applyTheme(themeName, existingCustomization);

    res.status(200).json({
      success: true,
      data: {
        customization,
        css: ThemeService.generateThemeCSS(customization)
      }
    });
  } catch (error: any) {
    console.error('Apply theme error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error applying theme'
    });
  }
});

/**
 * @route   POST /api/themes/validate
 * @desc    Validate theme customization
 * @access  Public
 */
router.post('/validate', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { customization } = req.body;

    if (!customization) {
      res.status(400).json({
        success: false,
        message: 'Customization object is required'
      });
      return;
    }

    const validation = ThemeService.validateCustomization(customization);

    res.status(200).json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('Theme validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating theme'
    });
  }
});

/**
 * @route   POST /api/themes/generate-css
 * @desc    Generate CSS for theme customization
 * @access  Public
 */
router.post('/generate-css', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { customization } = req.body;

    if (!customization) {
      res.status(400).json({
        success: false,
        message: 'Customization object is required'
      });
      return;
    }

    const css = ThemeService.generateThemeCSS(customization);
    const cssVariables = ThemeService.generateCssVariables(customization);

    res.status(200).json({
      success: true,
      data: {
        css,
        cssVariables,
        size: css.length
      }
    });
  } catch (error: any) {
    console.error('Generate CSS error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating CSS'
    });
  }
});

/**
 * @route   GET /api/themes/recommendations
 * @desc    Get theme recommendations
 * @access  Public
 */
router.get('/recommendations', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formType, industry } = req.query;

    const recommendations = ThemeService.getThemeRecommendations(
      formType as string,
      industry as string
    );

    res.status(200).json({
      success: true,
      data: recommendations
    });
  } catch (error: any) {
    console.error('Get theme recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting theme recommendations'
    });
  }
});

export default router;