import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Form from '../models/Form';
import User from '../models/User';
import CustomDomainService from '../services/CustomDomainService';

const router = express.Router();

// Domain validation
const validateDomain = [
  body('domain')
    .notEmpty()
    .withMessage('Domain is required')
    .isLength({ max: 253 })
    .withMessage('Domain name too long'),
  
  body('formId')
    .notEmpty()
    .withMessage('Form ID is required')
    .isMongoId()
    .withMessage('Invalid form ID format'),
];

/**
 * @route   POST /api/domains/add
 * @desc    Add custom domain to form
 * @access  Private
 */
router.post('/add', protect, withValidation(validateDomain), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { domain, formId } = req.body;

    // Check subscription limits
    if (req.user!.subscription?.plan !== 'professional' && req.user!.subscription?.plan !== 'enterprise') {
      res.status(403).json({
        success: false,
        message: 'Custom domains require Pro or Enterprise subscription'
      });
      return;
    }

    // Verify form ownership
    const form = await Form.findOne({ _id: formId, userId: req.user!._id });
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found or access denied'
      });
      return;
    }

    // Validate domain format
    const validation = CustomDomainService.validateDomain(domain);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid domain format',
        errors: validation.errors
      });
      return;
    }

    // Check domain availability
    const availability = await CustomDomainService.checkDomainAvailability(domain);
    if (!availability.isAvailable) {
      res.status(409).json({
        success: false,
        message: 'Domain is already in use',
        details: availability
      });
      return;
    }

    // Generate verification token
    const verificationToken = CustomDomainService.generateVerificationToken(req.user!._id.toString(), domain);

    // Store domain configuration
    const domainConfig = {
      domain,
      formId,
      userId: req.user!._id,
      verificationToken,
      isVerified: false,
      verificationMethod: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add to user's custom domains (assuming we extend User model)
    if (!(req.user as any).customDomains) {
      (req.user as any).customDomains = [];
    }
    (req.user as any).customDomains.push(domainConfig as any);
    await req.user!.save();

    // Generate verification instructions
    const instructions = CustomDomainService.generateVerificationInstructions(domain, verificationToken);

    res.status(201).json({
      success: true,
      data: {
        domain,
        formId,
        verificationToken,
        instructions,
        status: 'pending_verification'
      }
    });
  } catch (error: any) {
    console.error('Add domain error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding custom domain'
    });
  }
});

/**
 * @route   POST /api/domains/verify
 * @desc    Verify domain ownership
 * @access  Private
 */
router.post('/verify', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { domain } = req.body;

    if (!domain) {
      res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
      return;
    }

    // Find domain in user's custom domains
    const domainConfig = (req.user as any).customDomains?.find((d: any) => d.domain === domain);
    if (!domainConfig) {
      res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
      return;
    }

    // Verify domain ownership
    const verification = await CustomDomainService.verifyDomainOwnership(
      domain, 
      domainConfig.verificationToken
    );

    if (verification.isVerified) {
      // Update domain status
      domainConfig.isVerified = true;
      domainConfig.verificationMethod = verification.method;
      domainConfig.verifiedAt = new Date();
      domainConfig.updatedAt = new Date();
      
      await req.user!.save();

      // Check SSL status
      const sslStatus = await CustomDomainService.checkSSLStatus(domain);

      res.status(200).json({
        success: true,
        data: {
          domain,
          isVerified: true,
          method: verification.method,
          verifiedAt: domainConfig.verifiedAt,
          sslStatus,
          config: CustomDomainService.generateDomainConfig(domain, domainConfig.formId.toString())
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Domain verification failed',
        errors: verification.errors,
        instructions: CustomDomainService.generateVerificationInstructions(domain, domainConfig.verificationToken)
      });
    }
  } catch (error: any) {
    console.error('Verify domain error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying domain'
    });
  }
});

/**
 * @route   GET /api/domains
 * @desc    Get user's custom domains
 * @access  Private
 */
router.get('/', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const domains = (req.user as any).customDomains || [];

    // Populate form information
    const populatedDomains = await Promise.all(
      domains.map(async (domain: any) => {
        const form = await Form.findById(domain.formId).select('title description');
        return {
          ...domain,
          form: form ? { title: form.title, description: form.description } : null
        };
      })
    );

    res.status(200).json({
      success: true,
      data: populatedDomains,
      count: populatedDomains.length
    });
  } catch (error: any) {
    console.error('Get domains error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching custom domains'
    });
  }
});

/**
 * @route   DELETE /api/domains/:domain
 * @desc    Remove custom domain
 * @access  Private
 */
router.delete('/:domain', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { domain } = req.params;

    // Remove domain from user's custom domains
    if ((req.user as any).customDomains) {
      (req.user as any).customDomains = (req.user as any).customDomains.filter((d: any) => d.domain !== domain);
      await req.user!.save();
    }

    res.status(200).json({
      success: true,
      message: 'Custom domain removed successfully'
    });
  } catch (error: any) {
    console.error('Remove domain error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing custom domain'
    });
  }
});

/**
 * @route   GET /api/domains/:domain/config
 * @desc    Get domain configuration
 * @access  Private
 */
router.get('/:domain/config', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { domain } = req.params;

    // Find domain in user's custom domains
    const domainConfig = (req.user as any).customDomains?.find((d: any) => d.domain === domain);
    if (!domainConfig) {
      res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
      return;
    }

    const config = CustomDomainService.generateDomainConfig(domain, domainConfig.formId.toString());
    const sslStatus = await CustomDomainService.checkSSLStatus(domain);
    const analytics = await CustomDomainService.getDomainAnalytics(domain);

    res.status(200).json({
      success: true,
      data: {
        domain,
        config,
        sslStatus,
        analytics,
        isVerified: domainConfig.isVerified,
        verificationMethod: domainConfig.verificationMethod
      }
    });
  } catch (error: any) {
    console.error('Get domain config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching domain configuration'
    });
  }
});

/**
 * @route   POST /api/domains/:domain/ssl-check
 * @desc    Check SSL certificate status
 * @access  Private
 */
router.post('/:domain/ssl-check', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { domain } = req.params;

    // Verify domain ownership
    const domainConfig = (req.user as any).customDomains?.find((d: any) => d.domain === domain);
    if (!domainConfig) {
      res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
      return;
    }

    const sslStatus = await CustomDomainService.checkSSLStatus(domain);

    res.status(200).json({
      success: true,
      data: {
        domain,
        ssl: sslStatus,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('SSL check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking SSL status'
    });
  }
});

/**
 * @route   GET /api/domains/validate/:domain
 * @desc    Validate domain format
 * @access  Public
 */
router.get('/validate/:domain', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { domain } = req.params;
    const validation = CustomDomainService.validateDomain(domain);

    res.status(200).json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('Domain validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating domain'
    });
  }
});

export default router;