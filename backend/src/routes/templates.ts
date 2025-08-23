import express, { Response } from 'express';
import { protect, AuthenticatedRequest, optionalAuth } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Template from '../models/Template';
import Form from '../models/Form';
import { ITemplate, IForm } from '../types';

const router = express.Router();

// Template creation validation
const validateTemplate = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ max: 100 })
    .withMessage('Template name cannot exceed 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Template description cannot exceed 500 characters'),
  
  body('category')
    .isIn([
      'business', 'education', 'healthcare', 'nonprofit', 'technology',
      'marketing', 'events', 'research', 'hr', 'customer-service',
      'real-estate', 'finance', 'legal', 'creative', 'other'
    ])
    .withMessage('Invalid template category'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Each tag cannot exceed 30 characters'),
  
  body('formData.title')
    .trim()
    .notEmpty()
    .withMessage('Form title is required for template'),
  
  body('formData.fields')
    .isArray({ min: 1 })
    .withMessage('Template must have at least one field'),
];

// Template rating validation
const validateRating = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment cannot exceed 500 characters'),
];

// Query interfaces
interface TemplateQuery {
  page?: string;
  limit?: string;
  category?: string;
  tags?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isPremium?: string;
  isOfficial?: string;
}

/**
 * @route   GET /api/templates
 * @desc    Browse templates with filtering and search
 * @access  Public
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '12',
      category,
      tags,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isPremium,
      isOfficial
    }: TemplateQuery = req.query;

    // Build query
    const query: any = {
      isPublic: true,
      isActive: true
    };

    // Add filters
    if (category) {
      query.category = category;
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    if (isPremium !== undefined) {
      query.isPremium = isPremium === 'true';
    }

    if (isOfficial !== undefined) {
      query.isOfficial = isOfficial === 'true';
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort options
    const sortOptions: any = {};
    if (sortBy === 'popularity') {
      sortOptions['analytics.usageCount'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'rating') {
      sortOptions['analytics.averageRating'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    // Pagination options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
      populate: [
        {
          path: 'createdBy',
          select: 'firstName lastName email'
        }
      ]
    };

    const templates = await (Template as any).paginate(query, options);

    // For authenticated users, check if they've used each template
    if (req.user) {
      for (const template of templates.docs) {
        const hasUsed = await Form.exists({
          userId: req.user._id,
          templateId: template._id
        });
        (template as any).hasUsed = !!hasUsed;
      }
    }

    res.status(200).json({
      success: true,
      data: templates.docs,
      pagination: {
        page: templates.page,
        pages: templates.totalPages,
        total: templates.totalDocs,
        limit: templates.limit
      }
    });
  } catch (error: any) {
    console.error('Browse templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching templates'
    });
  }
});

/**
 * @route   GET /api/templates/categories
 * @desc    Get all template categories with counts
 * @access  Public
 */
router.get('/categories', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const categories = await Template.aggregate([
      {
        $match: {
          isPublic: true,
          isActive: true
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: categories.map(cat => ({
        category: cat._id,
        count: cat.count
      }))
    });
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
});

/**
 * @route   GET /api/templates/popular
 * @desc    Get popular templates
 * @access  Public
 */
router.get('/popular', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { limit = '8' } = req.query;

    const templates = await Template.find({
      isPublic: true,
      isActive: true
    })
    .sort({ 'analytics.usageCount': -1, 'analytics.averageRating': -1 })
    .limit(parseInt(limit as string))
    .populate('createdBy', 'firstName lastName')
    .lean();

    res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    console.error('Get popular templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular templates'
    });
  }
});

/**
 * @route   GET /api/templates/:id
 * @desc    Get specific template details
 * @access  Public
 */
router.get('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isPublic: true,
      isActive: true
    }).populate('createdBy', 'firstName lastName email');

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    // Increment view count
    await Template.findByIdAndUpdate(
      template._id,
      { $inc: { 'analytics.views': 1 } }
    );

    // Check if user has used this template
    let hasUsed = false;
    if (req.user) {
      const userForm = await Form.exists({
        userId: req.user._id,
        templateId: template._id
      });
      hasUsed = !!userForm;
    }

    res.status(200).json({
      success: true,
      data: {
        ...template.toObject(),
        hasUsed
      }
    });
  } catch (error: any) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching template'
    });
  }
});

/**
 * @route   POST /api/templates
 * @desc    Create custom template from form
 * @access  Private
 */
router.post('/', protect, withValidation(validateTemplate), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      category,
      tags = [],
      formData,
      isPublic = false,
      isPremium = false
    } = req.body;

    // Create template
    const template = await Template.create({
      name,
      description,
      category,
      tags,
      formData,
      isPublic,
      isPremium,
      isOfficial: false, // Only admins can create official templates
      createdBy: req.user!._id
    });

    await template.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: template
    });
  } catch (error: any) {
    console.error('Create template error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating template'
    });
  }
});

/**
 * @route   POST /api/templates/:id/use
 * @desc    Create form from template
 * @access  Private
 */
router.post('/:id/use', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isPublic: true,
      isActive: true
    });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    // Check if user has premium access for premium templates
    if (template.isPremium && req.user!.subscription.plan === 'free') {
      res.status(403).json({
        success: false,
        message: 'Premium subscription required to use this template'
      });
      return;
    }

    // Create form from template
    const formData = {
      ...template.formData,
      userId: req.user!._id,
      templateId: template._id,
      title: `${template.formData.title} (Copy)`
    };

    const form = await Form.create(formData);

    // Increment template usage count
    await Template.findByIdAndUpdate(
      template._id,
      { $inc: { 'analytics.usageCount': 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Form created from template',
      data: form
    });
  } catch (error: any) {
    console.error('Use template error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating form from template'
    });
  }
});

/**
 * @route   POST /api/templates/:id/rate
 * @desc    Rate a template
 * @access  Private
 */
router.post('/:id/rate', protect, withValidation(validateRating), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { rating, comment } = req.body;

    const template = await Template.findOne({
      _id: req.params.id,
      isPublic: true,
      isActive: true
    });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    // Check if user has already rated this template
    const existingRatingIndex = template.ratings.findIndex(
      r => r.userId.toString() === req.user!._id.toString()
    );

    if (existingRatingIndex !== -1) {
      // Update existing rating
      template.ratings[existingRatingIndex] = {
        userId: req.user!._id,
        rating,
        comment,
        createdAt: new Date()
      };
    } else {
      // Add new rating
      template.ratings.push({
        userId: req.user!._id,
        rating,
        comment,
        createdAt: new Date()
      });
    }

    // Recalculate average rating
    const totalRating = template.ratings.reduce((sum, r) => sum + r.rating, 0);
    template.analytics.averageRating = totalRating / template.ratings.length;
    template.analytics.totalRatings = template.ratings.length;

    await template.save();

    res.status(200).json({
      success: true,
      message: 'Template rated successfully',
      data: {
        averageRating: template.analytics.averageRating,
        totalRatings: template.analytics.totalRatings
      }
    });
  } catch (error: any) {
    console.error('Rate template error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rating template'
    });
  }
});

/**
 * @route   GET /api/templates/my/created
 * @desc    Get user's created templates
 * @access  Private
 */
router.get('/my/created', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '10' } = req.query;

    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sort: { createdAt: -1 }
    };

    const templates = await (Template as any).paginate(
      { createdBy: req.user!._id, isActive: true },
      options
    );

    res.status(200).json({
      success: true,
      data: templates.docs,
      pagination: {
        page: templates.page,
        pages: templates.totalPages,
        total: templates.totalDocs,
        limit: templates.limit
      }
    });
  } catch (error: any) {
    console.error('Get user templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your templates'
    });
  }
});

/**
 * @route   PUT /api/templates/:id
 * @desc    Update template
 * @access  Private
 */
router.put('/:id', protect, withValidation(validateTemplate), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      createdBy: req.user!._id,
      isActive: true
    });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    const {
      name,
      description,
      category,
      tags,
      formData,
      isPublic
    } = req.body;

    // Update template
    Object.assign(template, {
      name,
      description,
      category,
      tags,
      formData,
      isPublic
    });

    await template.save();

    res.status(200).json({
      success: true,
      message: 'Template updated successfully',
      data: template
    });
  } catch (error: any) {
    console.error('Update template error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating template'
    });
  }
});

/**
 * @route   DELETE /api/templates/:id
 * @desc    Delete template (soft delete)
 * @access  Private
 */
router.delete('/:id', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      createdBy: req.user!._id,
      isActive: true
    });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found'
      });
      return;
    }

    // Soft delete
    template.isActive = false;
    await template.save();

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting template'
    });
  }
});

export default router;