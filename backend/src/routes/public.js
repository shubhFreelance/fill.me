const express = require('express');
const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const { validateFormResponse } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure multer for form file uploads
const fileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_DIR || '../uploads');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    cb(null, `form-file-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileUpload = multer({
  storage: fileStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
  },
  fileFilter: function (req, file, cb) {
    // Allow all file types for form uploads, but still have some restrictions
    const allowedTypes = /\.(jpg|jpeg|png|gif|pdf|doc|docx|txt|csv|xlsx|xls)$/i;
    const extname = allowedTypes.test(path.extname(file.originalname));

    if (extname || process.env.NODE_ENV === 'development') {
      return cb(null, true);
    } else {
      cb(new Error('File type not allowed. Allowed types: images, PDF, Word documents, text files, spreadsheets'));
    }
  }
});

// Rate limiting for form submissions
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 submissions per windowMs
  message: {
    success: false,
    message: 'Too many form submissions, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route   GET /api/public/forms/:publicUrl
 * @desc    Get public form by public URL
 * @access  Public
 */
router.get('/forms/:publicUrl', async (req, res) => {
  try {
    const form = await Form.findByPublicUrl(req.params.publicUrl);

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found or not publicly accessible'
      });
    }

    // Increment view count
    await form.incrementViews();

    // Return only public data
    res.status(200).json({
      success: true,
      data: form.getPublicData()
    });
  } catch (error) {
    console.error('Get public form error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form'
    });
  }
});

/**
 * @route   POST /api/public/forms/:publicUrl/submit
 * @desc    Submit response to public form
 * @access  Public
 */
router.post('/forms/:publicUrl/submit', submissionLimiter, fileUpload.any(), async (req, res) => {
  try {
    let { responses, metadata } = req.body;

    // Parse responses if it's a string (from FormData)
    if (typeof responses === 'string') {
      try {
        responses = JSON.parse(responses);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid responses format'
        });
      }
    }

    // Parse metadata if it's a string
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (error) {
        metadata = {};
      }
    }

    // Find the form
    const form = await Form.findByPublicUrl(req.params.publicUrl);

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found or not publicly accessible'
      });
    }

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const fieldName = file.fieldname;
        const fileInfo = {
          originalName: file.originalname,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`
        };
        responses[fieldName] = fileInfo;
      });
    }

    // Create form response
    const formResponse = new FormResponse({
      formId: form._id,
      responses,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: {
        referrer: req.get('Referer'),
        ...metadata
      }
    });

    // Validate response against form fields
    const isValid = await formResponse.validateAgainstForm();

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Form validation failed',
        errors: formResponse.validationErrors
      });
    }

    // Save the response
    await formResponse.save();

    res.status(201).json({
      success: true,
      message: 'Response submitted successfully',
      data: {
        id: formResponse._id,
        submittedAt: formResponse.submittedAt
      }
    });
  } catch (error) {
    console.error('Submit form response error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting form response'
    });
  }
});

/**
 * @route   GET /api/public/forms/:publicUrl/preview
 * @desc    Get form preview without incrementing views
 * @access  Public
 */
router.get('/forms/:publicUrl/preview', async (req, res) => {
  try {
    const form = await Form.findByPublicUrl(req.params.publicUrl);

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found or not publicly accessible'
      });
    }

    // Return public data without incrementing views
    res.status(200).json({
      success: true,
      data: form.getPublicData()
    });
  } catch (error) {
    console.error('Get form preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form preview'
    });
  }
});

/**
 * @route   GET /api/public/forms/:publicUrl/embed
 * @desc    Get form embed code and data
 * @access  Public
 */
router.get('/forms/:publicUrl/embed', async (req, res) => {
  try {
    const form = await Form.findByPublicUrl(req.params.publicUrl);

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found or not publicly accessible'
      });
    }

    // Increment view count for embed
    await form.incrementViews();

    res.status(200).json({
      success: true,
      data: {
        form: form.getPublicData(),
        embedCode: form.embedCode,
        embedUrl: `${process.env.FRONTEND_URL}/embed/${form.publicUrl}`
      }
    });
  } catch (error) {
    console.error('Get form embed error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form embed data'
    });
  }
});

/**
 * @route   POST /api/public/forms/:publicUrl/validate
 * @desc    Validate form data without submitting
 * @access  Public
 */
router.post('/forms/:publicUrl/validate', async (req, res) => {
  try {
    const { responses } = req.body;

    // Find the form
    const form = await Form.findByPublicUrl(req.params.publicUrl);

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found or not publicly accessible'
      });
    }

    // Create temporary response for validation
    const tempResponse = new FormResponse({
      formId: form._id,
      responses
    });

    // Validate without saving
    const isValid = await tempResponse.validateAgainstForm();

    res.status(200).json({
      success: true,
      data: {
        isValid,
        errors: tempResponse.validationErrors
      }
    });
  } catch (error) {
    console.error('Validate form error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating form'
    });
  }
});

module.exports = router;