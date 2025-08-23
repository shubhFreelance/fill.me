const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// Workspace member schema
const workspaceMemberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String,
    required: true,
    enum: ['owner', 'admin', 'editor', 'viewer'],
    default: 'viewer'
  },
  permissions: {
    createForms: {
      type: Boolean,
      default: false
    },
    editForms: {
      type: Boolean,
      default: false
    },
    deleteForms: {
      type: Boolean,
      default: false
    },
    viewResponses: {
      type: Boolean,
      default: false
    },
    exportData: {
      type: Boolean,
      default: false
    },
    manageIntegrations: {
      type: Boolean,
      default: false
    },
    inviteMembers: {
      type: Boolean,
      default: false
    },
    manageBilling: {
      type: Boolean,
      default: false
    }
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  joinedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: 'pending'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Workspace billing schema
const workspaceBillingSchema = new mongoose.Schema({
  plan: {
    type: String,
    enum: ['free', 'starter', 'professional', 'enterprise'],
    default: 'free'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  subscriptionId: {
    type: String // Stripe subscription ID
  },
  customerId: {
    type: String // Stripe customer ID
  },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  trialEndsAt: Date,
  canceledAt: Date,
  limits: {
    maxForms: {
      type: Number,
      default: 3 // Free plan limit
    },
    maxResponses: {
      type: Number,
      default: 100 // Free plan limit
    },
    maxMembers: {
      type: Number,
      default: 1 // Free plan limit
    },
    maxFileStorage: {
      type: Number,
      default: 100 // MB, Free plan limit
    }
  }
}, { _id: false });

// Workspace settings schema
const workspaceSettingsSchema = new mongoose.Schema({
  branding: {
    logo: String,
    primaryColor: {
      type: String,
      default: '#3b82f6'
    },
    customDomain: String,
    removeBranding: {
      type: Boolean,
      default: false
    }
  },
  security: {
    requireSso: {
      type: Boolean,
      default: false
    },
    allowedDomains: [String],
    ipWhitelist: [String],
    enforcePasswordPolicy: {
      type: Boolean,
      default: false
    }
  },
  notifications: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    slackIntegration: {
      enabled: {
        type: Boolean,
        default: false
      },
      webhookUrl: String,
      channel: String
    },
    webhooks: [{
      name: String,
      url: String,
      events: [String],
      isActive: {
        type: Boolean,
        default: true
      }
    }]
  },
  dataRetention: {
    deleteResponsesAfter: {
      type: Number, // Days
      default: 0 // 0 means never delete
    },
    anonymizeAfter: {
      type: Number, // Days
      default: 0 // 0 means never anonymize
    },
    gdprCompliant: {
      type: Boolean,
      default: false
    }
  }
}, { _id: false });

// Workspace analytics schema
const workspaceAnalyticsSchema = new mongoose.Schema({
  totalForms: {
    type: Number,
    default: 0
  },
  totalResponses: {
    type: Number,
    default: 0
  },
  activeMembers: {
    type: Number,
    default: 1
  },
  storageUsed: {
    type: Number, // In MB
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Main workspace schema
const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Workspace name is required'],
    trim: true,
    maxlength: [100, 'Workspace name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Workspace description cannot be more than 500 characters']
  },
  slug: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  // Owner and members
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  members: [workspaceMemberSchema],
  // Billing and subscription
  billing: {
    type: workspaceBillingSchema,
    default: () => ({})
  },
  // Workspace settings
  settings: {
    type: workspaceSettingsSchema,
    default: () => ({})
  },
  // Analytics and usage
  analytics: {
    type: workspaceAnalyticsSchema,
    default: () => ({})
  },
  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  isPaused: {
    type: Boolean,
    default: false
  },
  pausedReason: String,
  pausedAt: Date,
  // Audit fields
  lastActivityAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total members count
workspaceSchema.virtual('memberCount').get(function() {
  return this.members.filter(member => member.status === 'active').length + 1; // +1 for owner
});

// Virtual for active forms count
workspaceSchema.virtual('formsCount', {
  ref: 'Form',
  localField: '_id',
  foreignField: 'workspaceId',
  count: true,
  match: { isActive: true }
});

// Virtual for billing status
workspaceSchema.virtual('billingStatus').get(function() {
  if (!this.billing.isActive) return 'inactive';
  if (this.billing.trialEndsAt && this.billing.trialEndsAt > new Date()) return 'trial';
  if (this.billing.canceledAt) return 'canceled';
  return 'active';
});

// Virtual for usage limits
workspaceSchema.virtual('usageLimits').get(function() {
  const limits = this.billing.limits;
  const analytics = this.analytics;
  
  return {
    forms: {
      used: analytics.totalForms,
      limit: limits.maxForms,
      percentage: limits.maxForms > 0 ? (analytics.totalForms / limits.maxForms) * 100 : 0
    },
    responses: {
      used: analytics.totalResponses,
      limit: limits.maxResponses,
      percentage: limits.maxResponses > 0 ? (analytics.totalResponses / limits.maxResponses) * 100 : 0
    },
    members: {
      used: this.memberCount,
      limit: limits.maxMembers,
      percentage: limits.maxMembers > 0 ? (this.memberCount / limits.maxMembers) * 100 : 0
    },
    storage: {
      used: analytics.storageUsed,
      limit: limits.maxFileStorage,
      percentage: limits.maxFileStorage > 0 ? (analytics.storageUsed / limits.maxFileStorage) * 100 : 0
    }
  };
});

// Indexes for performance
workspaceSchema.index({ ownerId: 1, isActive: 1 });
workspaceSchema.index({ slug: 1 });
workspaceSchema.index({ 'members.userId': 1 });
workspaceSchema.index({ 'billing.plan': 1 });
workspaceSchema.index({ createdAt: -1 });

// Generate slug before saving
workspaceSchema.pre('save', async function(next) {
  if (this.isNew && !this.slug) {
    const baseSlug = this.name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
    
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique
    while (await this.constructor.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    this.slug = slug;
  }
  next();
});

// Static method to find user workspaces
workspaceSchema.statics.findUserWorkspaces = function(userId) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { ownerId: userId },
          { 'members.userId': userId, 'members.status': 'active' }
        ]
      }
    ]
  }).populate('ownerId', 'firstName lastName email');
};

// Static method to check user access
workspaceSchema.statics.checkUserAccess = async function(workspaceId, userId) {
  const workspace = await this.findById(workspaceId);
  if (!workspace) return null;
  
  // Check if user is owner
  if (workspace.ownerId.toString() === userId.toString()) {
    return {
      role: 'owner',
      permissions: {
        createForms: true,
        editForms: true,
        deleteForms: true,
        viewResponses: true,
        exportData: true,
        manageIntegrations: true,
        inviteMembers: true,
        manageBilling: true
      }
    };
  }
  
  // Check if user is member
  const member = workspace.members.find(
    m => m.userId.toString() === userId.toString() && m.status === 'active'
  );
  
  if (member) {
    return {
      role: member.role,
      permissions: member.permissions
    };
  }
  
  return null;
};

// Instance method to add member
workspaceSchema.methods.addMember = function(userId, role = 'viewer', invitedBy) {
  // Check if user is already a member
  const existingMember = this.members.find(m => m.userId.toString() === userId.toString());
  if (existingMember) {
    throw new Error('User is already a member of this workspace');
  }
  
  // Set permissions based on role
  const permissions = this.getDefaultPermissions(role);
  
  this.members.push({
    userId,
    role,
    permissions,
    invitedBy,
    status: 'pending'
  });
  
  return this.save();
};

// Instance method to update member role
workspaceSchema.methods.updateMemberRole = function(userId, newRole) {
  const member = this.members.find(m => m.userId.toString() === userId.toString());
  if (!member) {
    throw new Error('User is not a member of this workspace');
  }
  
  member.role = newRole;
  member.permissions = this.getDefaultPermissions(newRole);
  
  return this.save();
};

// Instance method to remove member
workspaceSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(m => m.userId.toString() !== userId.toString());
  return this.save();
};

// Instance method to get default permissions for role
workspaceSchema.methods.getDefaultPermissions = function(role) {
  const rolePermissions = {
    viewer: {
      createForms: false,
      editForms: false,
      deleteForms: false,
      viewResponses: true,
      exportData: false,
      manageIntegrations: false,
      inviteMembers: false,
      manageBilling: false
    },
    editor: {
      createForms: true,
      editForms: true,
      deleteForms: false,
      viewResponses: true,
      exportData: true,
      manageIntegrations: false,
      inviteMembers: false,
      manageBilling: false
    },
    admin: {
      createForms: true,
      editForms: true,
      deleteForms: true,
      viewResponses: true,
      exportData: true,
      manageIntegrations: true,
      inviteMembers: true,
      manageBilling: false
    }
  };
  
  return rolePermissions[role] || rolePermissions.viewer;
};

// Instance method to update analytics
workspaceSchema.methods.updateAnalytics = async function() {
  const Form = mongoose.model('Form');
  const FormResponse = mongoose.model('FormResponse');
  
  // Get all forms in this workspace
  const forms = await Form.find({ workspaceId: this._id, isActive: true });
  const formIds = forms.map(f => f._id);
  
  // Calculate analytics
  const totalResponses = await FormResponse.countDocuments({
    formId: { $in: formIds }
  });
  
  // Calculate storage used (approximate)
  const storageUsed = Math.round(totalResponses * 0.1); // Rough estimate: 0.1MB per response
  
  this.analytics = {
    totalForms: forms.length,
    totalResponses,
    activeMembers: this.members.filter(m => m.status === 'active').length + 1,
    storageUsed,
    lastUpdated: new Date()
  };
  
  return this.save();
};

// Add pagination plugin
workspaceSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Workspace', workspaceSchema);