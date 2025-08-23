import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { validateForm, withValidation } from '../middleware/validation';
import { apiRateLimit, uploadRateLimit } from '../middleware/rateLimiting';
import { IForm, IFormField } from '../types';

const router = express.Router();

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_DIR || '../uploads');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    cb(null, `logo-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Query interface for forms listing
interface FormsQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * @route   GET /api/forms
 * @desc    Get all forms for authenticated user
 * @access  Private
 */
router.get('/', protect, apiRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '10', search, sortBy = 'updatedAt', sortOrder = 'desc' }: FormsQuery = req.query;
    
    const query: any = { 
      userId: req.user!._id, 
      isActive: true 
    };

    // Add search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: [
        {
          path: 'responseCount',
          select: 'count'
        }
      ]
    };

    const forms = await (Form as any).paginate(query, options);

    // Sync analytics for forms that might have outdated submission counts
    const updatedForms = [];
    for (const form of forms.docs) {
      try {
        // Check if form has responses but analytics shows 0 submissions
        const actualSubmissionCount = await FormResponse.countDocuments({
          formId: form._id,
          isValid: true
        });
        
        if (actualSubmissionCount !== form.analytics.submissions) {
          console.log(`Syncing analytics for form ${form.title}: ${actualSubmissionCount} actual vs ${form.analytics.submissions} stored`);
          const updatedForm = await Form.findByIdAndUpdate(
            form._id,
            { 'analytics.submissions': actualSubmissionCount },
            { new: true }
          );
          updatedForms.push(updatedForm);
        } else {
          updatedForms.push(form);
        }
      } catch (syncError) {
        console.error(`Error syncing form ${form._id}:`, syncError);
        updatedForms.push(form);
      }
    }

    res.status(200).json({
      success: true,
      data: updatedForms,
      pagination: {
        page: forms.page,
        pages: forms.totalPages,
        total: forms.totalDocs,
        limit: forms.limit
      }
    });
  } catch (error: any) {
    console.error('Get forms error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching forms'
    });
  }
});

/**
 * @route   GET /api/forms/:id
 * @desc    Get single form by ID
 * @access  Private
 */
router.get('/:id', protect, apiRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const form = await Form.findOne({
      _id: req.params.id,
      userId: req.user!._id,
      isActive: true
    }).populate('responseCount');

    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: form
    });
  } catch (error: any) {
    console.error('Get form error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form'
    });
  }
});

// Form creation interface
interface CreateFormBody {
  title: string;
  description?: string;
  fields: IFormField[];
  customization?: any;
  isPublic?: boolean;
}

/**
 * @route   POST /api/forms
 * @desc    Create new form
 * @access  Private
 */
router.post('/', protect, apiRateLimit, withValidation(validateForm), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, fields, customization, isPublic = true }: CreateFormBody = req.body;

    // Add user ID to form data
    const formData = {
      title,
      description,
      fields: fields.map((field, index) => ({
        ...field,
        id: field.id || uuidv4(),
        order: index
      })),
      customization: customization || {},
      isPublic,
      userId: req.user!._id
    };

    const form = await Form.create(formData);

    res.status(201).json({
      success: true,
      message: 'Form created successfully',
      data: form
    });
  } catch (error: any) {
    console.error('Create form error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating form'
    });
  }
});

/**
 * @route   PUT /api/forms/:id
 * @desc    Update form
 * @access  Private
 */
router.put('/:id', protect, withValidation(validateForm), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, fields, customization, isPublic }: CreateFormBody = req.body;

    const form = await Form.findOne({
      _id: req.params.id,
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

    // Update form fields
    const updateData = {
      title,
      description,
      fields: fields.map((field, index) => ({
        ...field,
        id: field.id || uuidv4(),
        order: index
      })),
      customization: { ...form.customization, ...customization },
      isPublic
    };

    const updatedForm = await Form.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Form updated successfully',
      data: updatedForm
    });
  } catch (error: any) {
    console.error('Update form error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating form'
    });
  }
});

/**
 * @route   DELETE /api/forms/:id
 * @desc    Delete form (soft delete)
 * @access  Private
 */
router.delete('/:id', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const form = await Form.findOne({
      _id: req.params.id,
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

    // Soft delete
    await Form.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Form deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete form error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting form'
    });
  }
});

/**
 * @route   POST /api/forms/:id/duplicate
 * @desc    Duplicate a form
 * @access  Private
 */
router.post('/:id/duplicate', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const originalForm = await Form.findOne({
      _id: req.params.id,
      userId: req.user!._id,
      isActive: true
    });

    if (!originalForm) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    // Create duplicate with new publicUrl
    const duplicateData = {
      title: `${originalForm.title} (Copy)`,
      description: originalForm.description,
      fields: originalForm.fields.map(field => ({
        ...(field as any).toObject(),
        id: uuidv4()
      })),
      customization: originalForm.customization,
      isPublic: originalForm.isPublic,
      userId: req.user!._id
    };

    const duplicateForm = await Form.create(duplicateData);

    res.status(201).json({
      success: true,
      message: 'Form duplicated successfully',
      data: duplicateForm
    });
  } catch (error: any) {
    console.error('Duplicate form error:', error);
    res.status(500).json({
      success: false,
      message: 'Error duplicating form'
    });
  }
});

/**
 * @route   POST /api/forms/:id/upload-logo
 * @desc    Upload logo for form
 * @access  Private
 */
router.post('/:id/upload-logo', protect, upload.single('logo'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
      return;
    }

    const form = await Form.findOne({
      _id: req.params.id,
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

    // Update form with logo URL
    const logoUrl = `/uploads/${req.file.filename}`;
    form.customization.logoUrl = logoUrl;
    await form.save();

    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      logoUrl: logoUrl
    });
  } catch (error: any) {
    console.error('Upload logo error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading logo'
    });
  }
});

/**
 * @route   GET /api/forms/:id/analytics
 * @desc    Get form analytics
 * @access  Private
 */
router.get('/:id/analytics', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const form = await Form.findOne({
      _id: req.params.id,
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

    // Get response analytics
    const responseAnalytics = await (FormResponse as any).getAnalytics(form._id);
    
    // Get recent responses
    const recentResponses = await (FormResponse as any).getFormResponses(form._id, {
      limit: 10,
      sort: { submittedAt: -1 }
    });

    const analytics = {
      totalViews: form.analytics.views,
      totalSubmissions: form.analytics.submissions,
      conversionRate: (form as any).conversionRate,
      responseAnalytics,
      recentResponses: recentResponses.map((response: any) => response.getFormattedData())
    };

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics'
    });
  }
});

/**
 * @route   POST /api/forms/:id/sync-analytics
 * @desc    Sync form analytics with actual response count
 * @access  Private
 */
router.post('/:id/sync-analytics', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const form = await Form.findOne({
      _id: req.params.id,
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

    // Sync analytics
    const updatedForm = await (Form as any).syncFormAnalytics(form._id);

    res.status(200).json({
      success: true,
      message: 'Analytics synced successfully',
      data: {
        totalSubmissions: updatedForm.analytics.submissions,
        totalViews: updatedForm.analytics.views
      }
    });
  } catch (error: any) {
    console.error('Sync analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing analytics'
    });
  }
});

/**
 * @route   POST /api/forms/sync-all-analytics
 * @desc    Sync analytics for all forms
 * @access  Private
 */
router.post('/sync-all-analytics', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Only allow this for development or if user is admin
    if (process.env.NODE_ENV !== 'development') {
      res.status(403).json({
        success: false,
        message: 'This operation is only allowed in development mode'
      });
      return;
    }

    await (Form as any).recalculateAnalytics();

    res.status(200).json({
      success: true,
      message: 'All form analytics synced successfully'
    });
  } catch (error: any) {
    console.error('Sync all analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing all analytics'
    });
  }
});

export default router;