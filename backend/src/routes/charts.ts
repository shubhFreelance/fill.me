import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { query, param } from 'express-validator';
import Form from '../models/Form';
import ChartVisualizationService, { IChartMetric, ITimeGrouping, IWidgetType } from '../services/ChartVisualizationService';

const router = express.Router();

// Validation middleware
const validateChartRequest = [
  param('formId')
    .isMongoId()
    .withMessage('Invalid form ID'),
  
  query('metric')
    .optional()
    .isIn(['views', 'submissions', 'starts', 'completions', 'abandons'])
    .withMessage('Invalid metric type'),
  
  query('groupBy')
    .optional()
    .isIn(['hour', 'day', 'week', 'month'])
    .withMessage('Invalid groupBy value'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
];

const validateWidgetRequest = [
  query('type')
    .isIn(['overview-stats', 'recent-activity', 'top-forms', 'conversion-summary'])
    .withMessage('Invalid widget type'),
];

/**
 * @route   GET /api/charts/time-series/:formId
 * @desc    Generate time series chart for form metrics
 * @access  Private
 */
router.get('/time-series/:formId', protect, withValidation(validateChartRequest), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { 
      metric = 'views',
      groupBy = 'day',
      startDate,
      endDate
    } = req.query;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Set default date range if not provided
    const dateRange = {
      start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date()
    };

    const chartData = await ChartVisualizationService.generateTimeSeriesChart(
      formId,
      metric as IChartMetric,
      dateRange,
      groupBy as ITimeGrouping
    );

    res.status(200).json({
      success: true,
      data: chartData
    });
  } catch (error: any) {
    console.error('Generate time series chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating time series chart'
    });
  }
});

/**
 * @route   GET /api/charts/device-distribution/:formId
 * @desc    Generate device distribution pie chart
 * @access  Private
 */
router.get('/device-distribution/:formId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const dateRange = {
      start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date()
    };

    const chartData = await ChartVisualizationService.generateDeviceDistributionChart(formId, dateRange);

    res.status(200).json({
      success: true,
      data: chartData
    });
  } catch (error: any) {
    console.error('Generate device distribution chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating device distribution chart'
    });
  }
});

/**
 * @route   GET /api/charts/form-comparison
 * @desc    Generate form comparison bar chart
 * @access  Private
 */
router.get('/form-comparison', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { 
      metric = 'submissions',
      limit = '10'
    } = req.query;

    const chartData = await ChartVisualizationService.generateFormComparisonChart(
      req.user!._id.toString(),
      metric as IChartMetric,
      parseInt(limit as string)
    );

    res.status(200).json({
      success: true,
      data: chartData
    });
  } catch (error: any) {
    console.error('Generate form comparison chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating form comparison chart'
    });
  }
});

/**
 * @route   GET /api/charts/conversion-funnel/:formId
 * @desc    Generate conversion funnel chart
 * @access  Private
 */
router.get('/conversion-funnel/:formId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const dateRange = {
      start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date()
    };

    const chartData = await ChartVisualizationService.generateConversionFunnelChart(formId, dateRange);

    res.status(200).json({
      success: true,
      data: chartData
    });
  } catch (error: any) {
    console.error('Generate conversion funnel chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating conversion funnel chart'
    });
  }
});

/**
 * @route   GET /api/charts/activity-heatmap/:formId
 * @desc    Generate activity heatmap chart
 * @access  Private
 */
router.get('/activity-heatmap/:formId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const dateRange = {
      start: startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default to 7 days
      end: endDate ? new Date(endDate as string) : new Date()
    };

    const chartData = await ChartVisualizationService.generateActivityHeatmapChart(formId, dateRange);

    res.status(200).json({
      success: true,
      data: chartData
    });
  } catch (error: any) {
    console.error('Generate activity heatmap chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating activity heatmap chart'
    });
  }
});

/**
 * @route   GET /api/charts/dashboard-widget
 * @desc    Generate dashboard widget data
 * @access  Private
 */
router.get('/dashboard-widget', protect, withValidation(validateWidgetRequest), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.query;

    const widget = await ChartVisualizationService.generateDashboardWidget(
      req.user!._id.toString(),
      type as IWidgetType
    );

    res.status(200).json({
      success: true,
      data: widget
    });
  } catch (error: any) {
    console.error('Generate dashboard widget error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating dashboard widget'
    });
  }
});

/**
 * @route   GET /api/charts/dashboard-bundle
 * @desc    Generate multiple dashboard widgets in one request
 * @access  Private
 */
router.get('/dashboard-bundle', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const widgetTypes: IWidgetType[] = ['overview-stats', 'recent-activity', 'top-forms', 'conversion-summary'];
    
    const widgets = await Promise.all(
      widgetTypes.map(async (type) => {
        try {
          return await ChartVisualizationService.generateDashboardWidget(req.user!._id.toString(), type);
        } catch (error) {
          console.error(`Error generating ${type} widget:`, error);
          return {
            type,
            title: `${type} (Error)`,
            data: { error: 'Failed to load data' },
            size: 'medium' as const
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      data: {
        widgets,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Generate dashboard bundle error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating dashboard bundle'
    });
  }
});

/**
 * @route   GET /api/charts/form/:formId/complete-analytics
 * @desc    Generate complete analytics package for a form
 * @access  Private
 */
router.get('/form/:formId/complete-analytics', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const dateRange = {
      start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date()
    };

    // Generate all chart types for the form
    const [
      timeSeriesChart,
      deviceDistributionChart,
      conversionFunnelChart,
      activityHeatmapChart
    ] = await Promise.all([
      ChartVisualizationService.generateTimeSeriesChart(formId, 'submissions', dateRange, 'day'),
      ChartVisualizationService.generateDeviceDistributionChart(formId, dateRange),
      ChartVisualizationService.generateConversionFunnelChart(formId, dateRange),
      ChartVisualizationService.generateActivityHeatmapChart(formId, dateRange)
    ]);

    res.status(200).json({
      success: true,
      data: {
        formId,
        formTitle: form.title,
        dateRange,
        charts: {
          timeSeries: timeSeriesChart,
          deviceDistribution: deviceDistributionChart,
          conversionFunnel: conversionFunnelChart,
          activityHeatmap: activityHeatmapChart
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Generate complete analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating complete analytics package'
    });
  }
});

/**
 * @route   GET /api/charts/export/:formId
 * @desc    Export chart data in various formats
 * @access  Private
 */
router.get('/export/:formId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { format = 'json', chartType = 'time-series' } = req.query;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const dateRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    };

    let chartData;
    switch (chartType) {
      case 'time-series':
        chartData = await ChartVisualizationService.generateTimeSeriesChart(formId, 'submissions', dateRange, 'day');
        break;
      case 'device-distribution':
        chartData = await ChartVisualizationService.generateDeviceDistributionChart(formId, dateRange);
        break;
      case 'conversion-funnel':
        chartData = await ChartVisualizationService.generateConversionFunnelChart(formId, dateRange);
        break;
      default:
        chartData = await ChartVisualizationService.generateTimeSeriesChart(formId, 'submissions', dateRange, 'day');
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="chart-data-${formId}.csv"`);
      
      // Convert chart data to CSV
      const csvData = convertChartDataToCSV(chartData);
      res.status(200).send(csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="chart-data-${formId}.json"`);
      
      res.status(200).json({
        success: true,
        data: chartData,
        exportedAt: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error('Export chart data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting chart data'
    });
  }
});

// Helper function to convert chart data to CSV
function convertChartDataToCSV(chartData: any): string {
  const headers = ['Label', 'Value'];
  const rows: string[][] = [];

  if (chartData.data.labels && chartData.data.datasets[0]) {
    chartData.data.labels.forEach((label: string, index: number) => {
      const value = chartData.data.datasets[0].data[index] || 0;
      rows.push([label, value.toString()]);
    });
  }

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

export default router;