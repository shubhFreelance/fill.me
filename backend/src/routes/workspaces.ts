import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import Workspace from '../models/Workspace';
import User from '../models/User';
import Form from '../models/Form';
import { IWorkspace, IWorkspaceMember } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Workspace creation validation
const validateWorkspace = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Workspace name is required')
    .isLength({ max: 100 })
    .withMessage('Workspace name cannot exceed 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Workspace description cannot exceed 500 characters'),
  
  body('slug')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Workspace slug cannot exceed 50 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Workspace slug can only contain lowercase letters, numbers, and hyphens'),
];

// Member invitation validation
const validateInvitation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('role')
    .isIn(['admin', 'editor', 'viewer'])
    .withMessage('Invalid role. Must be admin, editor, or viewer'),
  
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
];

// Member role update validation
const validateMemberUpdate = [
  body('role')
    .optional()
    .isIn(['admin', 'editor', 'viewer'])
    .withMessage('Invalid role. Must be admin, editor, or viewer'),
  
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
];

// Query interfaces
interface WorkspaceQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * @route   GET /api/workspaces
 * @desc    Get user's workspaces (owned and member)
 * @access  Private
 */
router.get('/', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    }: WorkspaceQuery = req.query;

    // Build query for workspaces where user is owner or member
    const query: any = {
      $or: [
        { ownerId: req.user!._id },
        { 'members.userId': req.user!._id, 'members.status': 'active' }
      ],
      isActive: true
    };

    // Add search functionality
    if (search) {
      query.$and = [
        query.$or ? { $or: query.$or } : {},
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          ]
        }
      ];
      delete query.$or;
    }

    // Build sort options
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
      populate: [
        {
          path: 'ownerId',
          select: 'firstName lastName email'
        },
        {
          path: 'members.userId',
          select: 'firstName lastName email'
        }
      ]
    };

    const workspaces = await (Workspace as any).paginate(query, options);

    // Add user's role in each workspace
    const workspacesWithRole = workspaces.docs.map((workspace: any) => {
      const workspaceObj = workspace.toObject();
      
      // Check if user is owner
      if (workspace.ownerId._id.toString() === req.user!._id.toString()) {
        workspaceObj.userRole = 'owner';
      } else {
        // Find user's role as member
        const member = workspace.members.find((m: any) => 
          m.userId._id.toString() === req.user!._id.toString()
        );
        workspaceObj.userRole = member ? member.role : 'viewer';
      }

      return workspaceObj;
    });

    res.status(200).json({
      success: true,
      data: workspacesWithRole,
      pagination: {
        page: workspaces.page,
        pages: workspaces.totalPages,
        total: workspaces.totalDocs,
        limit: workspaces.limit
      }
    });
  } catch (error: any) {
    console.error('Get workspaces error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workspaces'
    });
  }
});

/**
 * @route   POST /api/workspaces
 * @desc    Create new workspace
 * @access  Private
 */
router.post('/', protect, withValidation(validateWorkspace), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, description, slug } = req.body;

    // Generate slug if not provided
    const workspaceSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    // Check if slug is already taken
    const existingWorkspace = await Workspace.findOne({ slug: workspaceSlug });
    if (existingWorkspace) {
      res.status(400).json({
        success: false,
        message: 'Workspace slug is already taken'
      });
      return;
    }

    // Check user's subscription limits
    const userWorkspacesCount = await Workspace.countDocuments({
      ownerId: req.user!._id,
      isActive: true
    });

    const maxWorkspaces = req.user!.subscription.features.maxForms; // Assuming same limit
    if (userWorkspacesCount >= maxWorkspaces && req.user!.subscription.plan === 'free') {
      res.status(403).json({
        success: false,
        message: 'Workspace limit reached for your subscription plan'
      });
      return;
    }

    // Create workspace
    const workspace = await Workspace.create({
      name,
      description,
      slug: workspaceSlug,
      ownerId: req.user!._id
    });

    await workspace.populate('ownerId', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Workspace created successfully',
      data: workspace
    });
  } catch (error: any) {
    console.error('Create workspace error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating workspace'
    });
  }
});

/**
 * @route   GET /api/workspaces/:id
 * @desc    Get workspace details
 * @access  Private
 */
router.get('/:id', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const workspace = await Workspace.findById(req.params.id)
      .populate('ownerId', 'firstName lastName email')
      .populate('members.userId', 'firstName lastName email')
      .populate('members.invitedBy', 'firstName lastName email');

    if (!workspace) {
      res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
      return;
    }

    // Check if user has access to workspace
    const isOwner = workspace.ownerId._id.toString() === req.user!._id.toString();
    const isMember = workspace.members.some((member: any) => 
      member.userId._id.toString() === req.user!._id.toString() && member.status === 'active'
    );

    if (!isOwner && !isMember) {
      res.status(403).json({
        success: false,
        message: 'Access denied to this workspace'
      });
      return;
    }

    // Get workspace forms count
    const formsCount = await Form.countDocuments({
      workspaceId: workspace._id,
      isActive: true
    });

    // Add user's role
    let userRole = 'viewer';
    if (isOwner) {
      userRole = 'owner';
    } else if (isMember) {
      const member = workspace.members.find((m: any) => 
        m.userId._id.toString() === req.user!._id.toString()
      );
      userRole = member?.role || 'viewer';
    }

    const workspaceData = {
      ...workspace.toObject(),
      userRole,
      formsCount
    };

    res.status(200).json({
      success: true,
      data: workspaceData
    });
  } catch (error: any) {
    console.error('Get workspace error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workspace'
    });
  }
});

/**
 * @route   PUT /api/workspaces/:id
 * @desc    Update workspace
 * @access  Private
 */
router.put('/:id', protect, withValidation(validateWorkspace), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
      return;
    }

    // Check if user is owner or admin
    const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
    const member = workspace.members.find((m: any) => 
      m.userId.toString() === req.user!._id.toString()
    );
    const isAdmin = member?.role === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Only workspace owners and admins can update workspace settings'
      });
      return;
    }

    const { name, description, slug } = req.body;

    // Check slug uniqueness if changing
    if (slug && slug !== workspace.slug) {
      const existingWorkspace = await Workspace.findOne({ 
        slug, 
        _id: { $ne: workspace._id } 
      });
      if (existingWorkspace) {
        res.status(400).json({
          success: false,
          message: 'Workspace slug is already taken'
        });
        return;
      }
    }

    // Update workspace
    Object.assign(workspace, { name, description, slug });
    await workspace.save();

    await workspace.populate('ownerId', 'firstName lastName email');

    res.status(200).json({
      success: true,
      message: 'Workspace updated successfully',
      data: workspace
    });
  } catch (error: any) {
    console.error('Update workspace error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating workspace'
    });
  }
});

/**
 * @route   DELETE /api/workspaces/:id
 * @desc    Delete workspace (soft delete)
 * @access  Private
 */
router.delete('/:id', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
      return;
    }

    // Only workspace owner can delete
    if (workspace.ownerId.toString() !== req.user!._id.toString()) {
      res.status(403).json({
        success: false,
        message: 'Only workspace owner can delete the workspace'
      });
      return;
    }

    // Soft delete
    workspace.isActive = false;
    await workspace.save();

    res.status(200).json({
      success: true,
      message: 'Workspace deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete workspace error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting workspace'
    });
  }
});

/**
 * @route   POST /api/workspaces/:id/invite
 * @desc    Invite user to workspace
 * @access  Private
 */
router.post('/:id/invite', protect, withValidation(validateInvitation), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, role, permissions } = req.body;

    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
      return;
    }

    // Check if user can invite (owner or admin)
    const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
    const member = workspace.members.find((m: any) => 
      m.userId.toString() === req.user!._id.toString()
    );
    const isAdmin = member?.role === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Only workspace owners and admins can invite members'
      });
      return;
    }

    // Find user by email
    const invitedUser = await User.findOne({ email, isActive: true });
    if (!invitedUser) {
      res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
      return;
    }

    // Check if user is already a member
    const existingMember = workspace.members.find((m: any) => 
      m.userId.toString() === invitedUser._id.toString()
    );

    if (existingMember) {
      res.status(400).json({
        success: false,
        message: 'User is already a member of this workspace'
      });
      return;
    }

    // Check workspace member limit
    const maxMembers = 10; // Default limit, can be based on subscription
    if (workspace.members.length >= maxMembers) {
      res.status(403).json({
        success: false,
        message: 'Workspace member limit reached'
      });
      return;
    }

    // Add member to workspace
    const newMember: IWorkspaceMember = {
      userId: invitedUser._id,
      role,
      permissions: permissions || {
        forms: {
          create: role !== 'viewer',
          read: true,
          update: role !== 'viewer',
          delete: role === 'admin'
        },
        analytics: {
          read: true
        },
        members: {
          invite: role === 'admin',
          manage: role === 'admin'
        }
      },
      invitedBy: req.user!._id,
      invitedAt: new Date(),
      joinedAt: new Date(),
      status: 'active',
      lastActivity: new Date()
    };

    workspace.members.push(newMember);
    (workspace.analytics as any).totalMembers = workspace.members.length;
    await workspace.save();

    await workspace.populate('members.userId', 'firstName lastName email');

    res.status(200).json({
      success: true,
      message: 'User invited to workspace successfully',
      data: newMember
    });
  } catch (error: any) {
    console.error('Invite member error:', error);
    res.status(500).json({
      success: false,
      message: 'Error inviting user to workspace'
    });
  }
});

/**
 * @route   PUT /api/workspaces/:id/members/:memberId
 * @desc    Update member role and permissions
 * @access  Private
 */
router.put('/:id/members/:memberId', protect, withValidation(validateMemberUpdate), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { role, permissions } = req.body;

    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
      return;
    }

    // Check if user can manage members (owner or admin)
    const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
    const member = workspace.members.find((m: any) => 
      m.userId.toString() === req.user!._id.toString()
    );
    const isAdmin = member?.role === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Only workspace owners and admins can manage members'
      });
      return;
    }

    // Find member to update
    const memberIndex = workspace.members.findIndex((m: any) => 
      m.userId.toString() === req.params.memberId
    );

    if (memberIndex === -1) {
      res.status(404).json({
        success: false,
        message: 'Member not found in workspace'
      });
      return;
    }

    // Update member
    if (role) {
      workspace.members[memberIndex].role = role;
    }
    if (permissions) {
      workspace.members[memberIndex].permissions = {
        ...workspace.members[memberIndex].permissions,
        ...permissions
      };
    }

    await workspace.save();

    res.status(200).json({
      success: true,
      message: 'Member updated successfully',
      data: workspace.members[memberIndex]
    });
  } catch (error: any) {
    console.error('Update member error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating member'
    });
  }
});

/**
 * @route   DELETE /api/workspaces/:id/members/:memberId
 * @desc    Remove member from workspace
 * @access  Private
 */
router.delete('/:id/members/:memberId', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
      return;
    }

    // Check if user can remove members (owner or admin, or removing self)
    const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
    const member = workspace.members.find((m: any) => 
      m.userId.toString() === req.user!._id.toString()
    );
    const isAdmin = member?.role === 'admin';
    const isRemovingSelf = req.params.memberId === req.user!._id.toString();

    if (!isOwner && !isAdmin && !isRemovingSelf) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions to remove member'
      });
      return;
    }

    // Remove member
    workspace.members = workspace.members.filter((m: any) => 
      m.userId.toString() !== req.params.memberId
    );

    (workspace.analytics as any).totalMembers = workspace.members.length;
    await workspace.save();

    res.status(200).json({
      success: true,
      message: 'Member removed from workspace successfully'
    });
  } catch (error: any) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing member from workspace'
    });
  }
});

/**
 * @route   GET /api/workspaces/:id/forms
 * @desc    Get workspace forms
 * @access  Private
 */
router.get('/:id/forms', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '10' } = req.query;

    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
      return;
    }

    // Check access
    const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
    const isMember = workspace.members.some((member: any) => 
      member.userId.toString() === req.user!._id.toString() && member.status === 'active'
    );

    if (!isOwner && !isMember) {
      res.status(403).json({
        success: false,
        message: 'Access denied to this workspace'
      });
      return;
    }

    // Get forms in workspace
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sort: { updatedAt: -1 },
      populate: [
        {
          path: 'userId',
          select: 'firstName lastName email'
        }
      ]
    };

    const forms = await (Form as any).paginate(
      { workspaceId: workspace._id, isActive: true },
      options
    );

    res.status(200).json({
      success: true,
      data: forms.docs,
      pagination: {
        page: forms.page,
        pages: forms.totalPages,
        total: forms.totalDocs,
        limit: forms.limit
      }
    });
  } catch (error: any) {
    console.error('Get workspace forms error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workspace forms'
    });
  }
});

export default router;