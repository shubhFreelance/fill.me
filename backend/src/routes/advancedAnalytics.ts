import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body, query } from 'express-validator';
import Form from '../models/Form';
import AdvancedAnalyticsService, { ISessionData, ISubmissionData } from '../services/AdvancedAnalyticsService';

const router = express.Router();

// Validation middleware
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO format'),
];

const validateTrackingData = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required'),
  
  body('device')
    .isIn(['mobile', 'tablet', 'desktop'])
    .withMessage('Device must be mobile, tablet, or desktop'),
  
  body('userAgent')
    .notEmpty()
    .withMessage('User agent is required'),
];

/**
 * @route   POST /api/advanced-analytics/track/view/:formId
 * @desc    Track form view event
 * @access  Public
 */
router.post('/track/view/:formId', withValidation(validateTrackingData), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const sessionData: ISessionData = {
      sessionId: req.body.sessionId,
      userAgent: req.body.userAgent,
      ipAddress: req.ip,
      referrer: req.body.referrer,
      device: req.body.device,
      location: req.body.location
    };

    await AdvancedAnalyticsService.trackFormView(formId, sessionData);

    res.status(200).json({
      success: true,
      message: 'View tracked successfully'
    });
  } catch (error: any) {
    console.error('Track view error:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking form view'
    });
  }
});

/**
 * @route   POST /api/advanced-analytics/track/submission/:formId/:responseId
 * @desc    Track form submission event
 * @access  Public
 */
router.post('/track/submission/:formId/:responseId', withValidation(validateTrackingData), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, responseId } = req.params;
    const sessionData: ISessionData = {
      sessionId: req.body.sessionId,
      userAgent: req.body.userAgent,
      ipAddress: req.ip,
      referrer: req.body.referrer,
      device: req.body.device,
      location: req.body.location
    };

    const submissionData: ISubmissionData = {
      completionTime: req.body.completionTime,
      fieldCount: req.body.fieldCount,
      validationErrors: req.body.validationErrors
    };

    await AdvancedAnalyticsService.trackFormSubmission(formId, responseId, sessionData, submissionData);

    res.status(200).json({
      success: true,
      message: 'Submission tracked successfully'
    });
  } catch (error: any) {
    console.error('Track submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking form submission'
    });
  }
});

/**
 * @route   GET /api/advanced-analytics/form/:formId
 * @desc    Get comprehensive analytics for a form
 * @access  Private
 */
router.get('/form/:formId', protect, withValidation(validateDateRange), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    let dateRange;
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };
    }

    const analytics = await AdvancedAnalyticsService.getFormAnalytics(formId, dateRange);

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('Get form analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form analytics'
    });
  }
});

/**
 * @route   GET /api/advanced-analytics/user
 * @desc    Get user analytics across all forms
 * @access  Private
 */
router.get('/user', protect, withValidation(validateDateRange), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    let dateRange;
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };
    }

    const analytics = await AdvancedAnalyticsService.getUserAnalytics(req.user!._id.toString(), dateRange);

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('Get user analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user analytics'
    });
  }
});

/**
 * @route   GET /api/advanced-analytics/dashboard
 * @desc    Get real-time dashboard data
 * @access  Private
 */
router.get('/dashboard', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dashboard = await AdvancedAnalyticsService.getRealTimeDashboard(req.user!._id.toString());

    res.status(200).json({
      success: true,
      data: dashboard
    });
  } catch (error: any) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data'
    });
  }
});

/**
 * @route   GET /api/advanced-analytics/form/:formId/summary
 * @desc    Get quick analytics summary for a form
 * @access  Private
 */
router.get('/form/:formId/summary', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const analytics = await AdvancedAnalyticsService.getFormAnalytics(formId);

    // Return only basic metrics for quick summary
    res.status(200).json({
      success: true,
      data: {
        basic: analytics.basic,
        insights: analytics.insights,
        responseCount: analytics.responseCount
      }
    });
  } catch (error: any) {
    console.error('Get form summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form summary'
    });
  }
});

/**
 * @route   GET /api/advanced-analytics/export/form/:formId
 * @desc    Export form analytics data
 * @access  Private
 */
router.get('/export/form/:formId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { format = 'json' } = req.query;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const analytics = await AdvancedAnalyticsService.getFormAnalytics(formId);

    // Set appropriate headers based on format
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${formId}.csv"`);
      
      // Convert analytics to CSV format
      const csv = convertAnalyticsToCSV(analytics);
      res.status(200).send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${formId}.json"`);
      
      res.status(200).json({
        success: true,
        data: analytics,
        exportedAt: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting analytics data'
    });
  }
});

/**
 * @route   POST /api/advanced-analytics/bulk-track
 * @desc    Track multiple events in bulk for performance
 * @access  Public
 */
router.post('/bulk-track', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Events array is required'
      });
      return;
    }

    // Process events in parallel
    const promises = events.map(async (event: any) => {
      try {
        const sessionData: ISessionData = {
          sessionId: event.sessionId,
          userAgent: event.userAgent,
          ipAddress: req.ip,
          referrer: event.referrer,
          device: event.device,
          location: event.location
        };

        if (event.type === 'view') {
          await AdvancedAnalyticsService.trackFormView(event.formId, sessionData);
        } else if (event.type === 'submission') {
          const submissionData: ISubmissionData = {
            completionTime: event.completionTime,
            fieldCount: event.fieldCount,
            validationErrors: event.validationErrors
          };
          await AdvancedAnalyticsService.trackFormSubmission(
            event.formId, 
            event.responseId, 
            sessionData, 
            submissionData
          );
        }
        return { success: true, eventId: event.id };
      } catch (error: any) {
        return { success: false, eventId: event.id, error: error.message };
      }
    });

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.status(200).json({
      success: true,
      data: {
        processed: events.length,
        successful,
        failed,
        results
      }
    });
  } catch (error: any) {
    console.error('Bulk track error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing bulk tracking'
    });
  }
});

// Helper method for CSV conversion
function convertAnalyticsToCSV(analytics: any): string {
  const headers = ['Metric', 'Value'];
  const rows = [
    ['Views', analytics.basic.views],
    ['Submissions', analytics.basic.submissions],
    ['Conversion Rate', `${analytics.basic.conversionRate.toFixed(2)}%`],
    ['Completion Rate', `${analytics.basic.completionRate.toFixed(2)}%`],
    ['Average Completion Time', `${analytics.basic.averageCompletionTime}s`],
    ['Peak Hour', analytics.timeAnalytics.peakHour],
    ['Mobile Percentage', `${analytics.deviceAnalytics.mobilePercentage.toFixed(2)}%`]
  ];

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

export default router;