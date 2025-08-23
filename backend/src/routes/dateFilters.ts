import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { query, body } from 'express-validator';
import DateRangeFilterService, { IDateRangePreset, ITimeGrouping } from '../services/DateRangeFilterService';

const router = express.Router();

// Validation middleware
const validateDateRangeQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO format'),
  
  query('preset')
    .optional()
    .isIn([
      'today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days',
      'this_week', 'last_week', 'this_month', 'last_month',
      'this_quarter', 'last_quarter', 'this_year', 'last_year', 'all_time'
    ])
    .withMessage('Invalid preset value'),
];

const validateDateRangeBody = [
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO format'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO format'),
  
  body('preset')
    .optional()
    .isIn([
      'today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days',
      'this_week', 'last_week', 'this_month', 'last_month',
      'this_quarter', 'last_quarter', 'this_year', 'last_year', 'all_time'
    ])
    .withMessage('Invalid preset value'),
];

/**
 * @route   GET /api/date-filters/presets
 * @desc    Get available date range presets
 * @access  Public
 */
router.get('/presets', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const presets = DateRangeFilterService.getAvailablePresets();

    res.status(200).json({
      success: true,
      data: {
        presets,
        count: presets.length,
        categories: {
          recent: presets.filter(p => p.category === 'recent'),
          calendar: presets.filter(p => p.category === 'calendar'),
          extended: presets.filter(p => p.category === 'extended')
        }
      }
    });
  } catch (error: any) {
    console.error('Get presets error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching date range presets'
    });
  }
});

/**
 * @route   GET /api/date-filters/parse
 * @desc    Parse and validate date range parameters
 * @access  Public
 */
router.get('/parse', withValidation(validateDateRangeQuery), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, preset } = req.query;

    const dateRange = DateRangeFilterService.parseDateRange(
      startDate as string,
      endDate as string,
      preset as IDateRangePreset
    );

    const validation = DateRangeFilterService.validateDateRange(dateRange);
    const formatted = DateRangeFilterService.formatDateRange(dateRange, 'long');
    const duration = DateRangeFilterService.calculateDuration(dateRange);
    const optimalGrouping = DateRangeFilterService.getOptimalTimeGrouping(dateRange);

    res.status(200).json({
      success: true,
      data: {
        dateRange,
        validation,
        formatted,
        duration,
        optimalGrouping,
        preset: preset || 'custom'
      }
    });
  } catch (error: any) {
    console.error('Parse date range error:', error);
    res.status(500).json({
      success: false,
      message: 'Error parsing date range'
    });
  }
});

/**
 * @route   POST /api/date-filters/validate
 * @desc    Validate a date range and return suggestions
 * @access  Public
 */
router.post('/validate', withValidation(validateDateRangeBody), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, preset } = req.body;

    const dateRange = DateRangeFilterService.parseDateRange(
      startDate,
      endDate,
      preset as IDateRangePreset
    );

    const validation = DateRangeFilterService.validateDateRange(dateRange);
    const comparisonRange = DateRangeFilterService.getComparisonDateRange(validation.dateRange);

    res.status(200).json({
      success: true,
      data: {
        original: dateRange,
        validated: validation,
        comparison: comparisonRange,
        suggestions: {
          formatted: DateRangeFilterService.formatDateRange(validation.dateRange, 'long'),
          optimalGrouping: validation.optimalGrouping,
          duration: validation.duration
        }
      }
    });
  } catch (error: any) {
    console.error('Validate date range error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating date range'
    });
  }
});

/**
 * @route   GET /api/date-filters/preset/:presetId
 * @desc    Get specific preset date range
 * @access  Public
 */
router.get('/preset/:presetId', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { presetId } = req.params;

    // Validate preset ID
    const availablePresets = DateRangeFilterService.getAvailablePresets();
    const presetConfig = availablePresets.find(p => p.id === presetId);

    if (!presetConfig) {
      res.status(400).json({
        success: false,
        message: 'Invalid preset ID',
        availablePresets: availablePresets.map(p => p.id)
      });
      return;
    }

    const dateRange = DateRangeFilterService.getPresetDateRange(presetId as IDateRangePreset);
    const validation = DateRangeFilterService.validateDateRange(dateRange);
    const formatted = DateRangeFilterService.formatDateRange(dateRange, 'long');

    res.status(200).json({
      success: true,
      data: {
        preset: presetConfig,
        dateRange,
        validation,
        formatted,
        duration: DateRangeFilterService.calculateDuration(dateRange),
        optimalGrouping: DateRangeFilterService.getOptimalTimeGrouping(dateRange)
      }
    });
  } catch (error: any) {
    console.error('Get preset date range error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting preset date range'
    });
  }
});

/**
 * @route   POST /api/date-filters/split
 * @desc    Split date range into intervals
 * @access  Public
 */
router.post('/split', withValidation(validateDateRangeBody), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, preset, intervalType = 'day' } = req.body;

    const dateRange = DateRangeFilterService.parseDateRange(
      startDate,
      endDate,
      preset as IDateRangePreset
    );

    const validation = DateRangeFilterService.validateDateRange(dateRange);
    
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid date range',
        errors: validation.errors,
        warnings: validation.warnings
      });
      return;
    }

    const intervals = DateRangeFilterService.splitDateRange(
      validation.dateRange,
      intervalType as ITimeGrouping
    );

    res.status(200).json({
      success: true,
      data: {
        originalRange: validation.dateRange,
        intervalType,
        intervals,
        count: intervals.length,
        formatted: intervals.map(interval => ({
          range: interval,
          formatted: DateRangeFilterService.formatDateRange(interval, 'short')
        }))
      }
    });
  } catch (error: any) {
    console.error('Split date range error:', error);
    res.status(500).json({
      success: false,
      message: 'Error splitting date range'
    });
  }
});

/**
 * @route   GET /api/date-filters/comparison/:presetId
 * @desc    Get comparison date range for a preset
 * @access  Public
 */
router.get('/comparison/:presetId', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { presetId } = req.params;

    // Validate preset ID
    const availablePresets = DateRangeFilterService.getAvailablePresets();
    const presetConfig = availablePresets.find(p => p.id === presetId);

    if (!presetConfig) {
      res.status(400).json({
        success: false,
        message: 'Invalid preset ID'
      });
      return;
    }

    const currentRange = DateRangeFilterService.getPresetDateRange(presetId as IDateRangePreset);
    const comparisonRange = DateRangeFilterService.getComparisonDateRange(currentRange);

    res.status(200).json({
      success: true,
      data: {
        preset: presetConfig,
        current: {
          range: currentRange,
          formatted: DateRangeFilterService.formatDateRange(currentRange, 'long')
        },
        comparison: {
          range: comparisonRange,
          formatted: DateRangeFilterService.formatDateRange(comparisonRange, 'long')
        },
        duration: DateRangeFilterService.calculateDuration(currentRange)
      }
    });
  } catch (error: any) {
    console.error('Get comparison range error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting comparison date range'
    });
  }
});

/**
 * @route   POST /api/date-filters/mongo-query
 * @desc    Generate MongoDB query for date filtering
 * @access  Private
 */
router.post('/mongo-query', protect, withValidation(validateDateRangeBody), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, preset, fieldName = 'createdAt' } = req.body;

    const dateRange = DateRangeFilterService.parseDateRange(
      startDate,
      endDate,
      preset as IDateRangePreset
    );

    const validation = DateRangeFilterService.validateDateRange(dateRange);
    
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid date range',
        errors: validation.errors
      });
      return;
    }

    const mongoQuery = DateRangeFilterService.generateMongoDateFilter(
      validation.dateRange,
      fieldName
    );

    res.status(200).json({
      success: true,
      data: {
        dateRange: validation.dateRange,
        fieldName,
        mongoQuery,
        duration: validation.duration,
        formatted: DateRangeFilterService.formatDateRange(validation.dateRange, 'long')
      }
    });
  } catch (error: any) {
    console.error('Generate mongo query error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating MongoDB query'
    });
  }
});

/**
 * @route   GET /api/date-filters/suggestions
 * @desc    Get date range suggestions based on data
 * @access  Private
 */
router.get('/suggestions', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const suggestions = [
      {
        id: 'last_7_days',
        label: 'Last 7 days',
        description: 'Most recent week of activity',
        range: DateRangeFilterService.getPresetDateRange('last_7_days'),
        category: 'recommended'
      },
      {
        id: 'last_30_days',
        label: 'Last 30 days',
        description: 'Monthly overview',
        range: DateRangeFilterService.getPresetDateRange('last_30_days'),
        category: 'recommended'
      },
      {
        id: 'this_month',
        label: 'This month',
        description: 'Current month progress',
        range: DateRangeFilterService.getPresetDateRange('this_month'),
        category: 'calendar'
      },
      {
        id: 'last_month',
        label: 'Last month',
        description: 'Previous month complete data',
        range: DateRangeFilterService.getPresetDateRange('last_month'),
        category: 'calendar'
      }
    ];

    // Add formatted versions
    const formattedSuggestions = suggestions.map(suggestion => ({
      ...suggestion,
      formatted: DateRangeFilterService.formatDateRange(suggestion.range, 'short'),
      duration: DateRangeFilterService.calculateDuration(suggestion.range),
      optimalGrouping: DateRangeFilterService.getOptimalTimeGrouping(suggestion.range)
    }));

    res.status(200).json({
      success: true,
      data: {
        suggestions: formattedSuggestions,
        generatedAt: now.toISOString()
      }
    });
  } catch (error: any) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting date range suggestions'
    });
  }
});

export default router;