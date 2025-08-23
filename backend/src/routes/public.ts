import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';

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
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
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

// File info interface
interface FileInfo {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
}

// Submit form interface
interface SubmitFormBody {
  responses: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * @route   GET /api/public/forms/:publicUrl
 * @desc    Get public form by public URL
 * @access  Public
 */
router.get('/forms/:publicUrl', async (req: Request, res: Response): Promise<void> => {
  try {
    const form = await (Form as any).findByPublicUrl(req.params.publicUrl);

    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or not publicly accessible'
      });
      return;
    }

    // Increment view count
    await (form as any).incrementViews();

    // Return only public data
    res.status(200).json({
      success: true,
      data: (form as any).getPublicData()
    });
  } catch (error: any) {
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
router.post('/forms/:publicUrl/submit', submissionLimiter, fileUpload.any(), async (req: Request, res: Response): Promise<void> => {
  try {
    let { responses, metadata }: SubmitFormBody = req.body;

    // Parse responses if it's a string (from FormData)
    if (typeof responses === 'string') {
      try {
        responses = JSON.parse(responses);
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid responses format'
        });
        return;
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
    const form = await (Form as any).findByPublicUrl(req.params.publicUrl);

    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or not publicly accessible'
      });
      return;
    }

    // Handle file uploads
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach((file: Express.Multer.File) => {
        const fieldName = file.fieldname;
        const fileInfo: FileInfo = {
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
      ipAddress: req.ip || (req.connection as any)?.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: {
        referrer: req.get('Referer'),
        ...metadata
      }
    });

    // Validate response against form fields
    const isValid = await (formResponse as any).validateAgainstForm();

    if (!isValid) {
      res.status(400).json({
        success: false,
        message: 'Form validation failed',
        errors: (formResponse as any).validationErrors
      });
      return;
    }

    // Save the response
    await formResponse.save();

    res.status(201).json({
      success: true,
      message: 'Response submitted successfully',
      data: {
        id: formResponse._id,
        submittedAt: (formResponse as any).submittedAt
      }
    });
  } catch (error: any) {
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
router.get('/forms/:publicUrl/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const form = await (Form as any).findByPublicUrl(req.params.publicUrl);

    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or not publicly accessible'
      });
      return;
    }

    // Return public data without incrementing views
    res.status(200).json({
      success: true,
      data: (form as any).getPublicData()
    });
  } catch (error: any) {
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
router.get('/forms/:publicUrl/embed', async (req: Request, res: Response): Promise<void> => {
  try {
    const form = await (Form as any).findByPublicUrl(req.params.publicUrl);

    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or not publicly accessible'
      });
      return;
    }

    // Increment view count for embed
    await (form as any).incrementViews();

    res.status(200).json({
      success: true,
      data: {
        form: (form as any).getPublicData(),
        embedCode: form.embedCode,
        embedUrl: `${process.env.FRONTEND_URL}/embed/${form.publicUrl}`
      }
    });
  } catch (error: any) {
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
router.post('/forms/:publicUrl/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { responses }: { responses: Record<string, any> } = req.body;

    // Find the form
    const form = await (Form as any).findByPublicUrl(req.params.publicUrl);

    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or not publicly accessible'
      });
      return;
    }

    // Create temporary response for validation
    const tempResponse = new FormResponse({
      formId: form._id,
      responses
    });

    // Validate without saving
    const isValid = await (tempResponse as any).validateAgainstForm();

    res.status(200).json({
      success: true,
      data: {
        isValid,
        errors: (tempResponse as any).validationErrors
      }
    });
  } catch (error: any) {
    console.error('Validate form error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating form'
    });
  }
});

export default router;