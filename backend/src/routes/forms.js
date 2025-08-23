const express = require('express');
const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const { protect } = require('../middleware/auth');
const { validateForm } = require('../middleware/validation');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
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

/**
 * @route   GET /api/forms
 * @desc    Get all forms for authenticated user
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;
    
    const query = { 
      userId: req.user._id, 
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

    const forms = await Form.paginate(query, options);

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
  } catch (error) {
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
router.get('/:id', protect, async (req, res) => {
  try {
    const form = await Form.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    }).populate('responseCount');

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    res.status(200).json({
      success: true,
      data: form
    });
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form'
    });
  }
});

/**
 * @route   POST /api/forms
 * @desc    Create new form
 * @access  Private
 */
router.post('/', protect, validateForm, async (req, res) => {
  try {
    const { title, description, fields, customization, isPublic = true } = req.body;

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
      userId: req.user._id
    };

    const form = await Form.create(formData);

    res.status(201).json({
      success: true,
      message: 'Form created successfully',
      data: form
    });
  } catch (error) {
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
router.put('/:id', protect, validateForm, async (req, res) => {
  try {
    const { title, description, fields, customization, isPublic } = req.body;

    const form = await Form.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
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
  } catch (error) {
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
router.delete('/:id', protect, async (req, res) => {
  try {
    const form = await Form.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    // Soft delete
    await Form.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Form deleted successfully'
    });
  } catch (error) {
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
router.post('/:id/duplicate', protect, async (req, res) => {
  try {
    const originalForm = await Form.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!originalForm) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    // Create duplicate with new publicUrl
    const duplicateData = {
      title: `${originalForm.title} (Copy)`,
      description: originalForm.description,
      fields: originalForm.fields.map(field => ({
        ...field.toObject(),
        id: uuidv4()
      })),
      customization: originalForm.customization,
      isPublic: originalForm.isPublic,
      userId: req.user._id
    };

    const duplicateForm = await Form.create(duplicateData);

    res.status(201).json({
      success: true,
      message: 'Form duplicated successfully',
      data: duplicateForm
    });
  } catch (error) {
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
router.post('/:id/upload-logo', protect, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const form = await Form.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
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
  } catch (error) {
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
router.get('/:id/analytics', protect, async (req, res) => {
  try {
    const form = await Form.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    // Get response analytics
    const responseAnalytics = await FormResponse.getAnalytics(form._id);
    
    // Get recent responses
    const recentResponses = await FormResponse.getFormResponses(form._id, {
      limit: 10,
      sort: { submittedAt: -1 }
    });

    const analytics = {
      totalViews: form.analytics.views,
      totalSubmissions: form.analytics.submissions,
      conversionRate: form.conversionRate,
      responseAnalytics,
      recentResponses: recentResponses.map(response => response.getFormattedData())
    };

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
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
router.post('/:id/sync-analytics', protect, async (req, res) => {
  try {
    const form = await Form.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    // Sync analytics
    const updatedForm = await Form.syncFormAnalytics(form._id);

    res.status(200).json({
      success: true,
      message: 'Analytics synced successfully',
      data: {
        totalSubmissions: updatedForm.analytics.submissions,
        totalViews: updatedForm.analytics.views
      }
    });
  } catch (error) {
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
router.post('/sync-all-analytics', protect, async (req, res) => {
  try {
    // Only allow this for development or if user is admin
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: 'This operation is only allowed in development mode'
      });
    }

    await Form.recalculateAnalytics();

    res.status(200).json({
      success: true,
      message: 'All form analytics synced successfully'
    });
  } catch (error) {
    console.error('Sync all analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing all analytics'
    });
  }
});

module.exports = router;