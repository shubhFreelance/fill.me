import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import PartialSubmissionService from '../services/PartialSubmissionService';
import Form from '../models/Form';

const router = express.Router();

// Validation middleware
const validateSavePartialSubmission = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isLength({ min: 10, max: 100 })
    .withMessage('Session ID must be between 10 and 100 characters'),
  
  body('responses')
    .isObject()
    .withMessage('Responses must be an object'),
  
  body('metadata.timeSpent')
    .optional()
    .isNumeric()
    .withMessage('Time spent must be a number'),
  
  body('metadata.ipAddress')
    .optional()
    .isIP()
    .withMessage('Invalid IP address format'),
];

const validateCompleteSubmission = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required'),
  
  body('responses')
    .isObject()
    .withMessage('Responses must be an object'),
];

const validateSessionId = [
  param('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isLength({ min: 10, max: 100 })
    .withMessage('Invalid session ID format'),
];

/**
 * @route   POST /api/partial-submissions/:formId/save
 * @desc    Save partial form submission
 * @access  Public
 */
router.post('/:formId/save', withValidation(validateSavePartialSubmission), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { sessionId, responses, metadata = {} } = req.body;

    // Verify form exists and auto-save is enabled
    const form = await Form.findById(formId);
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    if (!form.settings?.autoSave?.enabled) {
      res.status(400).json({
        success: false,
        message: 'Auto-save is not enabled for this form'
      });
      return;
    }

    // Extract metadata from request
    const enrichedMetadata = {
      ...metadata,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer
    };

    const result = await PartialSubmissionService.savePartialSubmission(
      formId,
      sessionId,
      responses,
      enrichedMetadata
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        data: {
          submissionId: result.submissionId,
          sessionId: result.sessionId,
          progress: result.progress,
          lastSavedAt: result.lastSavedAt,
          expiresAt: result.expiresAt,
          autoSaveEnabled: true
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to save partial submission'
      });
    }
  } catch (error: any) {
    console.error('Save partial submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving partial submission'
    });
  }
});

/**
 * @route   GET /api/partial-submissions/:formId/retrieve/:sessionId
 * @desc    Retrieve partial form submission
 * @access  Public
 */
router.get('/:formId/retrieve/:sessionId', withValidation(validateSessionId), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, sessionId } = req.params;

    // Verify form exists
    const form = await Form.findById(formId);
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    const result = await PartialSubmissionService.retrievePartialSubmission(formId, sessionId);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: {
          submissionId: result.submissionId,
          sessionId: result.sessionId,
          responses: result.responses,
          progress: result.progress,
          lastSavedAt: result.lastSavedAt,
          expiresAt: result.expiresAt,
          metadata: result.metadata,
          createdAt: result.createdAt
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error || 'No partial submission found'
      });
    }
  } catch (error: any) {
    console.error('Retrieve partial submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving partial submission'
    });
  }
});

/**
 * @route   POST /api/partial-submissions/:formId/complete
 * @desc    Complete partial form submission
 * @access  Public
 */
router.post('/:formId/complete', withValidation(validateCompleteSubmission), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { sessionId, responses, metadata = {} } = req.body;

    // Verify form exists
    const form = await Form.findById(formId);
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    // Extract metadata from request
    const enrichedMetadata = {
      ...metadata,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer
    };

    const result = await PartialSubmissionService.completePartialSubmission(
      formId,
      sessionId,
      responses,
      enrichedMetadata
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        data: {
          submissionId: result.submissionId,
          wasPartialSubmission: result.wasPartialSubmission,
          partialSubmissionData: result.partialSubmissionData,
          completedAt: new Date()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to complete submission'
      });
    }
  } catch (error: any) {
    console.error('Complete partial submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing submission'
    });
  }
});

/**
 * @route   DELETE /api/partial-submissions/:formId/delete/:sessionId
 * @desc    Delete partial form submission
 * @access  Public
 */
router.delete('/:formId/delete/:sessionId', withValidation(validateSessionId), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId, sessionId } = req.params;

    // Verify form exists
    const form = await Form.findById(formId);
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    const result = await PartialSubmissionService.deletePartialSubmission(formId, sessionId);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Partial submission deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error || 'Partial submission not found'
      });
    }
  } catch (error: any) {
    console.error('Delete partial submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting partial submission'
    });
  }
});

/**
 * @route   GET /api/partial-submissions/:formId/stats
 * @desc    Get partial submission statistics for a form
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

    const stats = await PartialSubmissionService.getPartialSubmissionStats(formId);

    res.status(200).json({
      success: true,
      data: {
        formId,
        formTitle: form.title,
        stats,
        autoSaveEnabled: form.settings?.autoSave?.enabled || false,
        autoSaveInterval: form.settings?.autoSave?.interval || 30
      }
    });
  } catch (error: any) {
    console.error('Get partial submission stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching partial submission statistics'
    });
  }
});

/**
 * @route   GET /api/partial-submissions/stats/global
 * @desc    Get global partial submission statistics (admin only)
 * @access  Private
 */
router.get('/stats/global', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check if user has admin permissions (you would implement this check)
    // For now, we'll allow all authenticated users
    
    const stats = await PartialSubmissionService.getPartialSubmissionStats();

    res.status(200).json({
      success: true,
      data: {
        globalStats: stats,
        timestamp: new Date()
      }
    });
  } catch (error: any) {
    console.error('Get global partial submission stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching global statistics'
    });
  }
});

/**
 * @route   POST /api/partial-submissions/cleanup
 * @desc    Clean up expired partial submissions (admin only)
 * @access  Private
 */
router.post('/cleanup', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check if user has admin permissions (you would implement this check)
    // For now, we'll allow all authenticated users
    
    const { olderThanDays = 30 } = req.body;

    if (olderThanDays < 1 || olderThanDays > 365) {
      res.status(400).json({
        success: false,
        message: 'Days parameter must be between 1 and 365'
      });
      return;
    }

    const result = await PartialSubmissionService.cleanupExpiredSubmissions(olderThanDays);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: {
          deletedCount: result.deletedCount,
          olderThanDays,
          cleanupDate: new Date()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Cleanup failed'
      });
    }
  } catch (error: any) {
    console.error('Cleanup partial submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing cleanup'
    });
  }
});

/**
 * @route   GET /api/partial-submissions/:formId/check-autosave
 * @desc    Check if auto-save is enabled for a form
 * @access  Public
 */
router.get('/:formId/check-autosave', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;

    const form = await Form.findById(formId).select('settings.autoSave title');
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    const autoSaveSettings = form.settings?.autoSave || { enabled: false, interval: 30 };

    res.status(200).json({
      success: true,
      data: {
        formId,
        formTitle: form.title,
        autoSaveEnabled: autoSaveSettings.enabled,
        autoSaveInterval: autoSaveSettings.interval,
        recommendedSaveFrequency: autoSaveSettings.enabled ? Math.max(5, autoSaveSettings.interval / 6) : null
      }
    });
  } catch (error: any) {
    console.error('Check auto-save error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking auto-save settings'
    });
  }
});

/**
 * @route   POST /api/partial-submissions/:formId/auto-save-config
 * @desc    Update auto-save configuration for a form
 * @access  Private
 */
router.post('/:formId/auto-save-config', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { enabled, interval = 30 } = req.body;

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Validate interval
    if (enabled && (interval < 1 || interval > 365)) {
      res.status(400).json({
        success: false,
        message: 'Auto-save interval must be between 1 and 365 days'
      });
      return;
    }

    // Update auto-save settings
    if (!form.settings) {
      form.settings = {} as any;
    }
    
    form.settings.autoSave = {
      enabled: Boolean(enabled),
      interval: interval
    };

    await form.save();

    res.status(200).json({
      success: true,
      data: {
        formId,
        autoSaveSettings: form.settings.autoSave,
        message: `Auto-save ${enabled ? 'enabled' : 'disabled'} successfully`
      }
    });
  } catch (error: any) {
    console.error('Update auto-save config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating auto-save configuration'
    });
  }
});

export default router;