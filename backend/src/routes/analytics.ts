import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';
import mongoose from 'mongoose';

const router = express.Router();

interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  formId?: string;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

/**
 * @route   GET /api/analytics/overview
 * @desc    Get overall analytics overview
 * @access  Private
 */
router.get('/overview', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, timeRange = '30d' }: AnalyticsQuery = req.query;

    // Calculate date range
    const dateRange = getDateRange(timeRange, startDate, endDate);

    // Get user's forms
    const userForms = await Form.find({ userId: req.user!._id }).select('_id');
    const formIds = userForms.map(form => form._id);

    // Aggregate analytics data
    const [
      totalForms,
      totalResponses,
      totalViews,
      responsesByDate,
      topForms,
      conversionRate
    ] = await Promise.all([
      Form.countDocuments({ userId: req.user!._id }),
      FormResponse.countDocuments({ 
        formId: { $in: formIds },
        submittedAt: { $gte: dateRange.start, $lte: dateRange.end }
      }),
      Form.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.user!._id) } },
        { $group: { _id: null, totalViews: { $sum: '$analytics.views' } } }
      ]),
      getResponsesByDate(formIds, dateRange),
      getTopForms(formIds, dateRange),
      calculateConversionRate(formIds, dateRange)
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalForms,
          totalResponses,
          totalViews: totalViews[0]?.totalViews || 0,
          conversionRate: conversionRate.rate,
          period: {
            start: dateRange.start,
            end: dateRange.end,
            range: timeRange
          }
        },
        trends: {
          responsesByDate,
          topForms
        }
      }
    });
  } catch (error: any) {
    console.error('Analytics overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics overview'
    });
  }
});

/**
 * @route   GET /api/analytics/form/:formId
 * @desc    Get detailed analytics for specific form
 * @access  Private
 */
router.get('/form/:formId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { startDate, endDate, timeRange = '30d' }: AnalyticsQuery = req.query;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    const dateRange = getDateRange(timeRange, startDate, endDate);

    // Get detailed form analytics
    const [
      formStats,
      responsesByDate,
      fieldAnalytics,
      deviceStats,
      referrerStats,
      completionFunnel
    ] = await Promise.all([
      getFormStats(formId, dateRange),
      getFormResponsesByDate(formId, dateRange),
      getFieldAnalytics(formId, dateRange),
      getDeviceStats(formId, dateRange),
      getReferrerStats(formId, dateRange),
      getCompletionFunnel(formId, dateRange)
    ]);

    res.status(200).json({
      success: true,
      data: {
        form: {
          id: form._id,
          title: form.title,
          createdAt: form.createdAt
        },
        stats: formStats,
        trends: {
          responsesByDate,
          fieldAnalytics,
          deviceStats,
          referrerStats,
          completionFunnel
        },
        period: {
          start: dateRange.start,
          end: dateRange.end,
          range: timeRange
        }
      }
    });
  } catch (error: any) {
    console.error('Form analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form analytics'
    });
  }
});

/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics data
 * @access  Private
 */
router.get('/export', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId, format = 'csv', startDate, endDate, timeRange = '30d' } = req.query;

    const dateRange = getDateRange(timeRange as string, startDate as string, endDate as string);
    
    let query: any = {};
    if (formId) {
      // Verify form ownership
      const form = await Form.findOne({ _id: formId, userId: req.user!._id });
      if (!form) {
        res.status(404).json({
          success: false,
          message: 'Form not found or access denied'
        });
        return;
      }
      query.formId = formId;
    } else {
      // Get all user's forms
      const userForms = await Form.find({ userId: req.user!._id }).select('_id');
      query.formId = { $in: userForms.map(f => f._id) };
    }

    query.submittedAt = { $gte: dateRange.start, $lte: dateRange.end };

    const analyticsData = await FormResponse.find(query)
      .populate('formId', 'title')
      .sort({ submittedAt: -1 });

    if (format === 'csv') {
      const csvData = formatAnalyticsAsCSV(analyticsData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
      res.send(csvData);
    } else {
      res.status(200).json({
        success: true,
        data: analyticsData,
        count: analyticsData.length
      });
    }
  } catch (error: any) {
    console.error('Analytics export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting analytics data'
    });
  }
});

// Helper functions

function getDateRange(timeRange: string, startDate?: string, endDate?: string) {
  const end = endDate ? new Date(endDate) : new Date();
  let start: Date;

  if (startDate) {
    start = new Date(startDate);
  } else {
    switch (timeRange) {
      case '7d':
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  return { start, end };
}

async function getResponsesByDate(formIds: any[], dateRange: any) {
  return await FormResponse.aggregate([
    {
      $match: {
        formId: { $in: formIds },
        submittedAt: { $gte: dateRange.start, $lte: dateRange.end }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
}

async function getTopForms(formIds: any[], dateRange: any) {
  return await FormResponse.aggregate([
    {
      $match: {
        formId: { $in: formIds },
        submittedAt: { $gte: dateRange.start, $lte: dateRange.end }
      }
    },
    {
      $group: {
        _id: '$formId',
        responses: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'forms',
        localField: '_id',
        foreignField: '_id',
        as: 'form'
      }
    },
    { $unwind: '$form' },
    {
      $project: {
        formId: '$_id',
        title: '$form.title',
        responses: 1
      }
    },
    { $sort: { responses: -1 } },
    { $limit: 5 }
  ]);
}

async function calculateConversionRate(formIds: any[], dateRange: any) {
  const [viewsData, responsesCount] = await Promise.all([
    Form.aggregate([
      { $match: { _id: { $in: formIds } } },
      { $group: { _id: null, totalViews: { $sum: '$analytics.views' } } }
    ]),
    FormResponse.countDocuments({
      formId: { $in: formIds },
      submittedAt: { $gte: dateRange.start, $lte: dateRange.end }
    })
  ]);

  const totalViews = viewsData[0]?.totalViews || 0;
  const rate = totalViews > 0 ? (responsesCount / totalViews) * 100 : 0;

  return { views: totalViews, responses: responsesCount, rate: Math.round(rate * 100) / 100 };
}

async function getFormStats(formId: string, dateRange: any) {
  const [form, responsesCount] = await Promise.all([
    Form.findById(formId),
    FormResponse.countDocuments({
      formId,
      submittedAt: { $gte: dateRange.start, $lte: dateRange.end }
    })
  ]);

  const conversionRate = form?.analytics.views > 0 
    ? (responsesCount / form.analytics.views) * 100 
    : 0;

  return {
    views: form?.analytics.views || 0,
    responses: responsesCount,
    conversionRate: Math.round(conversionRate * 100) / 100
  };
}

async function getFormResponsesByDate(formId: string, dateRange: any) {
  return await FormResponse.aggregate([
    {
      $match: {
        formId: new mongoose.Types.ObjectId(formId),
        submittedAt: { $gte: dateRange.start, $lte: dateRange.end }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
}

async function getFieldAnalytics(formId: string, dateRange: any) {
  const responses = await FormResponse.find({
    formId,
    submittedAt: { $gte: dateRange.start, $lte: dateRange.end }
  });

  const fieldStats: any = {};
  
  responses.forEach(response => {
    Object.entries(response.responses).forEach(([fieldId, value]) => {
      if (!fieldStats[fieldId]) {
        fieldStats[fieldId] = {
          fieldId,
          totalResponses: 0,
          uniqueValues: new Set(),
          valueFrequency: {}
        };
      }
      
      fieldStats[fieldId].totalResponses++;
      fieldStats[fieldId].uniqueValues.add(value);
      
      const valueStr = String(value);
      fieldStats[fieldId].valueFrequency[valueStr] = 
        (fieldStats[fieldId].valueFrequency[valueStr] || 0) + 1;
    });
  });

  // Convert Sets to arrays and format data
  Object.values(fieldStats).forEach((stat: any) => {
    stat.uniqueCount = stat.uniqueValues.size;
    delete stat.uniqueValues;
  });

  return Object.values(fieldStats);
}

async function getDeviceStats(formId: string, dateRange: any) {
  return await FormResponse.aggregate([
    {
      $match: {
        formId: new mongoose.Types.ObjectId(formId),
        submittedAt: { $gte: dateRange.start, $lte: dateRange.end }
      }
    },
    {
      $group: {
        _id: '$metadata.device',
        count: { $sum: 1 }
      }
    }
  ]);
}

async function getReferrerStats(formId: string, dateRange: any) {
  return await FormResponse.aggregate([
    {
      $match: {
        formId: new mongoose.Types.ObjectId(formId),
        submittedAt: { $gte: dateRange.start, $lte: dateRange.end }
      }
    },
    {
      $group: {
        _id: '$metadata.referrer',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
}

async function getCompletionFunnel(formId: string, dateRange: any) {
  // This would require tracking form starts vs completions
  // For now, return placeholder data
  return {
    started: 100,
    completed: 75,
    abandoned: 25,
    completionRate: 75
  };
}

function formatAnalyticsAsCSV(data: any[]): string {
  if (data.length === 0) return 'No data available';

  const headers = ['Form Title', 'Response ID', 'Submitted At', 'Responses'];
  const rows = data.map(item => [
    item.formId.title,
    item._id,
    item.submittedAt.toISOString(),
    JSON.stringify(item.responses)
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  return csvContent;
}

export default router;