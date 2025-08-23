import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import ExportService from '../services/ExportService';
import Form from '../models/Form';

const router = express.Router();

// Validation middleware
const validateExportRequest = [
  query('format')
    .optional()
    .isIn(['excel', 'pdf', 'csv'])
    .withMessage('Format must be excel, pdf, or csv'),
  
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Invalid dateFrom format (use ISO 8601)'),
  
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Invalid dateTo format (use ISO 8601)'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50000 })
    .withMessage('Limit must be between 1 and 50000'),
  
  query('includeMetadata')
    .optional()
    .isBoolean()
    .withMessage('includeMetadata must be boolean'),
  
  query('includeSummary')
    .optional()
    .isBoolean()
    .withMessage('includeSummary must be boolean'),
  
  query('includeAnalysis')
    .optional()
    .isBoolean()
    .withMessage('includeAnalysis must be boolean'),
];

const validateBulkExportRequest = [
  body('format')
    .notEmpty()
    .isIn(['excel', 'pdf', 'csv'])
    .withMessage('Format must be excel, pdf, or csv'),
  
  body('options.dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Invalid dateFrom format'),
  
  body('options.dateTo')
    .optional()
    .isISO8601()
    .withMessage('Invalid dateTo format'),
  
  body('options.selectedFields')
    .optional()
    .isArray()
    .withMessage('selectedFields must be an array'),
  
  body('options.filters')
    .optional()
    .isArray()
    .withMessage('filters must be an array'),
];

/**
 * @route   GET /api/exports/:formId/excel
 * @desc    Export form responses to Excel format
 * @access  Private
 */
router.get('/:formId/excel', protect, withValidation(validateExportRequest), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Parse query parameters
    const options = {
      format: 'excel' as const,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      selectedFields: req.query.selectedFields ? String(req.query.selectedFields).split(',') : undefined,
      includeMetadata: req.query.includeMetadata === 'true',
      includeSummary: req.query.includeSummary === 'true',
      includeAnalysis: req.query.includeAnalysis === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };

    const result = await ExportService.exportToExcel(formId, options);

    if (result.success && result.data) {
      res.setHeader('Content-Type', result.data.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.data.filename}"`);
      res.setHeader('Content-Length', result.data.size);
      res.setHeader('X-Export-Records', result.data.recordCount);
      res.setHeader('X-Export-Date', result.data.exportedAt.toISOString());
      
      res.send(result.data.buffer);
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Export failed'
      });
    }
  } catch (error: any) {
    console.error('Excel export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting to Excel'
    });
  }
});

/**
 * @route   GET /api/exports/:formId/pdf
 * @desc    Export form responses to PDF format
 * @access  Private
 */
router.get('/:formId/pdf', protect, withValidation(validateExportRequest), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Parse query parameters
    const options = {
      format: 'pdf' as const,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      selectedFields: req.query.selectedFields ? String(req.query.selectedFields).split(',') : undefined,
      includeMetadata: req.query.includeMetadata === 'true',
      includeSummary: req.query.includeSummary === 'true',
      includeAnalysis: req.query.includeAnalysis === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50 // Lower default for PDF
    };

    const result = await ExportService.exportToPDF(formId, options);

    if (result.success && result.data) {
      res.setHeader('Content-Type', result.data.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.data.filename}"`);
      res.setHeader('Content-Length', result.data.size);
      res.setHeader('X-Export-Records', result.data.recordCount);
      res.setHeader('X-Export-Date', result.data.exportedAt.toISOString());
      
      res.send(result.data.buffer);
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Export failed'
      });
    }
  } catch (error: any) {
    console.error('PDF export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting to PDF'
    });
  }
});

/**
 * @route   GET /api/exports/:formId/csv
 * @desc    Export form responses to CSV format
 * @access  Private
 */
router.get('/:formId/csv', protect, withValidation(validateExportRequest), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Parse query parameters
    const options = {
      format: 'csv' as const,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      selectedFields: req.query.selectedFields ? String(req.query.selectedFields).split(',') : undefined,
      includeMetadata: req.query.includeMetadata === 'true',
      includeSummary: req.query.includeSummary === 'true',
      includeAnalysis: req.query.includeAnalysis === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };

    const result = await ExportService.exportToCSV(formId, options);

    if (result.success && result.data) {
      res.setHeader('Content-Type', result.data.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.data.filename}"`);
      res.setHeader('Content-Length', result.data.size);
      res.setHeader('X-Export-Records', result.data.recordCount);
      res.setHeader('X-Export-Date', result.data.exportedAt.toISOString());
      
      res.send(result.data.buffer);
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Export failed'
      });
    }
  } catch (error: any) {
    console.error('CSV export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting to CSV'
    });
  }
});

/**
 * @route   POST /api/exports/:formId/bulk
 * @desc    Bulk export with advanced options
 * @access  Private
 */
router.post('/:formId/bulk', protect, withValidation(validateBulkExportRequest), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { format, options = {} } = req.body;
    
    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    let result;
    
    switch (format) {
      case 'excel':
        result = await ExportService.exportToExcel(formId, { format, ...options });
        break;
      case 'pdf':
        result = await ExportService.exportToPDF(formId, { format, ...options });
        break;
      case 'csv':
        result = await ExportService.exportToCSV(formId, { format, ...options });
        break;
      default:
        res.status(400).json({
          success: false,
          message: 'Invalid export format'
        });
        return;
    }

    if (result.success && result.data) {
      res.setHeader('Content-Type', result.data.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.data.filename}"`);
      res.setHeader('Content-Length', result.data.size);
      res.setHeader('X-Export-Records', result.data.recordCount);
      res.setHeader('X-Export-Date', result.data.exportedAt.toISOString());
      
      res.send(result.data.buffer);
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Export failed'
      });
    }
  } catch (error: any) {
    console.error('Bulk export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing bulk export'
    });
  }
});

/**
 * @route   GET /api/exports/:formId/stats
 * @desc    Get export statistics and capabilities
 * @access  Private
 */
router.get('/:formId/stats', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const stats = await ExportService.getExportStats(formId);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Export stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching export statistics'
    });
  }
});

/**
 * @route   GET /api/exports/:formId/preview
 * @desc    Get export preview (first 10 rows)
 * @access  Private
 */
router.get('/:formId/preview', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { format = 'csv' } = req.query;
    
    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Get preview with limited records
    const options = {
      limit: 10,
      includeMetadata: true,
      includeSummary: false,
      includeAnalysis: false
    };

    let result;
    
    switch (format) {
      case 'excel':
        result = await ExportService.exportToExcel(formId, options);
        break;
      case 'pdf':
        result = await ExportService.exportToPDF(formId, options);
        break;
      case 'csv':
      default:
        result = await ExportService.exportToCSV(formId, options);
        break;
    }

    if (result.success && result.data) {
      res.status(200).json({
        success: true,
        data: {
          previewData: result.data.buffer.toString('base64'),
          metadata: result.data.metadata,
          filename: result.data.filename,
          size: result.data.size,
          recordCount: result.data.recordCount
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Preview generation failed'
      });
    }
  } catch (error: any) {
    console.error('Export preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating export preview'
    });
  }
});

/**
 * @route   GET /api/exports/formats
 * @desc    Get available export formats and their capabilities
 * @access  Public
 */
router.get('/formats', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const formats = {
      excel: {
        name: 'Microsoft Excel',
        extension: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        maxRecords: 10000,
        features: {
          multipleSheets: true,
          formatting: true,
          charts: false,
          summary: true,
          analysis: true,
          metadata: true
        },
        description: 'Rich spreadsheet format with multiple sheets and formatting options'
      },
      pdf: {
        name: 'Portable Document Format',
        extension: 'pdf',
        mimeType: 'application/pdf',
        maxRecords: 1000,
        features: {
          multipleSheets: false,
          formatting: true,
          charts: false,
          summary: false,
          analysis: false,
          metadata: true
        },
        description: 'Professional document format, ideal for sharing and printing'
      },
      csv: {
        name: 'Comma Separated Values',
        extension: 'csv',
        mimeType: 'text/csv',
        maxRecords: 50000,
        features: {
          multipleSheets: false,
          formatting: false,
          charts: false,
          summary: false,
          analysis: false,
          metadata: true
        },
        description: 'Simple, lightweight format compatible with all spreadsheet applications'
      }
    };

    res.status(200).json({
      success: true,
      data: {
        formats,
        defaultFormat: 'excel',
        supportedFilters: [
          'dateFrom',
          'dateTo',
          'selectedFields',
          'includeMetadata',
          'includeSummary',
          'includeAnalysis'
        ]
      }
    });
  } catch (error: any) {
    console.error('Get formats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching export formats'
    });
  }
});

export default router;