import express, { Response } from 'express';
import mongoose from 'mongoose';
import { Parser } from 'json2csv';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { IForm, IFormField } from '../types';

const router = express.Router();

// Query interfaces
interface ResponsesQuery {
  page?: string;
  limit?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

interface ExportQuery {
  startDate?: string;
  endDate?: string;
  format?: 'csv' | 'json';
}

/**
 * @route   GET /api/responses/forms/:formId
 * @desc    Get responses for a specific form
 * @access  Private
 */
router.get('/forms/:formId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', startDate, endDate, search }: ResponsesQuery = req.query;

    // Verify form ownership
    const form = await Form.findOne({
      _id: req.params.formId,
      userId: req.user!._id,
      isActive: true
    });

    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    // Build query options
    const options: any = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { submittedAt: -1 }
    };

    if (startDate) {
      options.startDate = startDate;
    }

    if (endDate) {
      options.endDate = endDate;
    }

    // Get responses
    const responses = await (FormResponse as any).getFormResponses(form._id, options);
    const totalResponses = await FormResponse.countDocuments({ 
      formId: form._id, 
      isValid: true 
    });

    // Format responses
    const formattedResponses = responses.map((response: any) => response.getFormattedData());

    res.status(200).json({
      success: true,
      data: formattedResponses,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(totalResponses / parseInt(limit)),
        total: totalResponses,
        limit: parseInt(limit)
      }
    });
  } catch (error: any) {
    console.error('Get form responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form responses'
    });
  }
});

/**
 * @route   GET /api/responses/forms/:formId/export
 * @desc    Export form responses to CSV
 * @access  Private
 */
router.get('/forms/:formId/export', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, format = 'csv' }: ExportQuery = req.query;

    // Verify form ownership
    const form = await Form.findOne({
      _id: req.params.formId,
      userId: req.user!._id,
      isActive: true
    }).lean() as IForm;

    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    // Build query options
    const options: any = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    // Get all responses
    const responses = await (FormResponse as any).getFormResponses(form._id, options);

    if (responses.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No responses found for the specified criteria'
      });
      return;
    }

    // Prepare data for export
    const exportData = responses.map((response: any) => {
      const flatData: Record<string, any> = {
        'Response ID': response._id,
        'Submitted At': response.submittedAt,
        'IP Address': response.ipAddress || 'N/A',
        'Valid': response.isValid ? 'Yes' : 'No'
      };

      // Add form field responses
      form.fields.forEach((field: IFormField) => {
        const value = response.responses[field.id];
        let formattedValue = 'N/A';

        if (value !== undefined && value !== null) {
          if (field.type === 'file' && typeof value === 'object' && value.filename) {
            // For file fields, export the file name and URL
            formattedValue = `${value.originalName || value.filename} (${process.env.FRONTEND_URL || 'http://localhost:3005'}${value.url})`;
          } else if (Array.isArray(value)) {
            formattedValue = value.join(', ');
          } else if (typeof value === 'object') {
            formattedValue = JSON.stringify(value);
          } else {
            formattedValue = String(value);
          }
        }

        flatData[field.label] = formattedValue;
      });

      return flatData;
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${form.title}-responses.json"`);
      res.status(200).json({
        success: true,
        form: {
          id: form._id,
          title: form.title,
          exportedAt: new Date()
        },
        responses: exportData
      });
      return;
    }

    // Default to CSV export
    try {
      const fields = Object.keys(exportData[0]);
      const parser = new Parser({ fields });
      const csv = parser.parse(exportData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${form.title}-responses.csv"`);
      res.status(200).send(csv);
    } catch (csvError) {
      console.error('CSV generation error:', csvError);
      res.status(500).json({
        success: false,
        message: 'Error generating CSV export'
      });
    }
  } catch (error: any) {
    console.error('Export responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting form responses'
    });
  }
});

/**
 * @route   GET /api/responses/:responseId
 * @desc    Get single response details
 * @access  Private
 */
router.get('/:responseId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const response = await FormResponse.findById(req.params.responseId)
      .populate({
        path: 'formId',
        match: { userId: req.user!._id },
        select: 'title fields userId'
      });

    if (!response || !response.formId) {
      res.status(404).json({
        success: false,
        message: 'Response not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...(response as any).getFormattedData(),
        form: {
          title: (response.formId as any).title,
          fields: (response.formId as any).fields
        }
      }
    });
  } catch (error: any) {
    console.error('Get response error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching response'
    });
  }
});

/**
 * @route   DELETE /api/responses/:responseId
 * @desc    Delete a response
 * @access  Private
 */
router.delete('/:responseId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const response = await FormResponse.findById(req.params.responseId)
      .populate({
        path: 'formId',
        match: { userId: req.user!._id },
        select: 'userId'
      });

    if (!response || !response.formId) {
      res.status(404).json({
        success: false,
        message: 'Response not found'
      });
      return;
    }

    await FormResponse.findByIdAndDelete(req.params.responseId);

    // Decrement submissions count
    await Form.findByIdAndUpdate(
      (response.formId as any)._id,
      { $inc: { 'analytics.submissions': -1 } }
    );

    res.status(200).json({
      success: true,
      message: 'Response deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete response error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting response'
    });
  }
});

/**
 * @route   GET /api/responses/forms/:formId/analytics
 * @desc    Get advanced analytics for form responses
 * @access  Private
 */
router.get('/forms/:formId/analytics', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Verify form ownership
    const form = await Form.findOne({
      _id: req.params.formId,
      userId: req.user!._id,
      isActive: true
    });

    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    // Get basic analytics
    const analytics = await (FormResponse as any).getAnalytics(form._id);

    // Get response trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyResponses = await FormResponse.aggregate([
      {
        $match: {
          formId: new mongoose.Types.ObjectId(form._id),
          submittedAt: { $gte: thirtyDaysAgo },
          isValid: true
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$submittedAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get field completion rates
    const fieldAnalytics: Record<string, any> = {};
    if (form.fields && form.fields.length > 0) {
      const totalResponses = analytics.totalResponses || 0;
      
      for (const field of form.fields) {
        const completedCount = await FormResponse.countDocuments({
          formId: form._id,
          [`responses.${field.id}`]: { $exists: true, $ne: '' },
          isValid: true
        });

        fieldAnalytics[field.id] = {
          label: field.label,
          type: field.type,
          completionRate: totalResponses > 0 ? (completedCount / totalResponses * 100).toFixed(2) : 0,
          completedCount,
          totalResponses
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalViews: form.analytics.views,
          totalSubmissions: form.analytics.submissions,
          conversionRate: (form as any).conversionRate,
          ...analytics
        },
        trends: {
          dailyResponses,
          period: '30 days'
        },
        fieldAnalytics
      }
    });
  } catch (error: any) {
    console.error('Get response analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching response analytics'
    });
  }
});

export default router;