const mongoose = require('mongoose');
const crypto = require('crypto');

// Integration credentials schema
const credentialsSchema = new mongoose.Schema({
  // For OAuth2 integrations
  accessToken: String,
  refreshToken: String,
  tokenExpiry: Date,
  
  // For API key integrations
  apiKey: String,
  secretKey: String,
  
  // For webhook integrations
  webhookUrl: String,
  webhookSecret: String,
  
  // For Slack integration
  slackTeamId: String,
  slackChannelId: String,
  slackChannelName: String,
  slackUserId: String,
  
  // For Google Sheets integration
  spreadsheetId: String,
  sheetId: String,
  sheetName: String,
  
  // For Stripe integration
  stripeAccountId: String,
  stripePublishableKey: String,
  
  // For Calendly integration
  calendlyUserId: String,
  calendlySchedulingUrl: String,
  
  // For Zapier/Make.com integrations
  zapierWebhookUrl: String,
  makeWebhookUrl: String,
  
  // Generic fields for custom integrations
  customFields: {
    type: Map,
    of: String
  }
}, { _id: false });

// Integration settings schema
const settingsSchema = new mongoose.Schema({
  // Webhook settings
  webhook: {
    retryAttempts: {
      type: Number,
      default: 3
    },
    retryDelay: {
      type: Number,
      default: 1000 // milliseconds
    },
    timeout: {
      type: Number,
      default: 30000 // milliseconds
    },
    includeMetadata: {
      type: Boolean,
      default: true
    },
    customHeaders: {
      type: Map,
      of: String
    }
  },
  
  // Google Sheets settings
  googleSheets: {
    appendMode: {
      type: String,
      enum: ['append', 'update'],
      default: 'append'
    },
    includeTimestamp: {
      type: Boolean,
      default: true
    },
    timestampColumn: {
      type: String,
      default: 'Timestamp'
    },
    fieldMapping: {
      type: Map,
      of: String // formFieldId -> sheetColumn
    }
  },
  
  // Slack settings
  slack: {
    messageFormat: {
      type: String,
      enum: ['simple', 'detailed', 'custom'],
      default: 'simple'
    },
    customTemplate: String,
    mentionUsers: [String],
    includeAttachments: {
      type: Boolean,
      default: false
    }
  },
  
  // Email settings
  email: {
    recipients: [String],
    subject: String,
    template: String,
    includeAttachments: {
      type: Boolean,
      default: false
    }
  },
  
  // Stripe settings
  stripe: {
    currency: {
      type: String,
      default: 'usd'
    },
    paymentMethods: [String],
    collectBillingAddress: {
      type: Boolean,
      default: false
    },
    allowPromotionCodes: {
      type: Boolean,
      default: false
    }
  }
}, { _id: false });

// Integration analytics schema
const analyticsSchema = new mongoose.Schema({
  totalExecutions: {
    type: Number,
    default: 0
  },
  successfulExecutions: {
    type: Number,
    default: 0
  },
  failedExecutions: {
    type: Number,
    default: 0
  },
  lastExecutionAt: Date,
  lastSuccessAt: Date,
  lastFailureAt: Date,
  lastError: String,
  averageResponseTime: {
    type: Number,
    default: 0 // milliseconds
  },
  uptime: {
    type: Number,
    default: 100 // percentage
  }
}, { _id: false });

// Main integration schema
const integrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Integration name is required'],
    trim: true,
    maxlength: [100, 'Integration name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Integration description cannot be more than 500 characters']
  },
  type: {
    type: String,
    required: true,
    enum: [
      'webhook',
      'google_sheets',
      'slack',
      'stripe',
      'calendly',
      'zapier',
      'make',
      'email',
      'sms',
      'discord',
      'teams',
      'custom'
    ]
  },
  // Associated entities
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Integration configuration
  credentials: credentialsSchema,
  settings: {
    type: settingsSchema,
    default: () => ({})
  },
  
  // Event triggers
  triggers: [{
    event: {
      type: String,
      enum: [
        'form_submitted',
        'form_viewed',
        'form_started',
        'form_completed',
        'form_abandoned',
        'response_updated',
        'response_deleted'
      ],
      required: true
    },
    conditions: {
      // Field-based conditions
      fieldConditions: [{
        fieldId: String,
        operator: {
          type: String,
          enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
        },
        value: mongoose.Schema.Types.Mixed
      }],
      // General conditions
      minResponseTime: Number, // milliseconds
      maxResponseTime: Number,
      requiredFields: [String]
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Status and control
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
  
  // Analytics and monitoring
  analytics: {
    type: analyticsSchema,
    default: () => ({})
  },
  
  // Rate limiting
  rateLimit: {
    maxExecutionsPerMinute: {
      type: Number,
      default: 60
    },
    maxExecutionsPerHour: {
      type: Number,
      default: 1000
    },
    maxExecutionsPerDay: {
      type: Number,
      default: 10000
    }
  },
  
  // Security
  encryptionKey: String, // For encrypting sensitive data
  lastValidatedAt: Date,
  validationErrors: [String],
  
  // Version control
  version: {
    type: String,
    default: '1.0.0'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for success rate
integrationSchema.virtual('successRate').get(function() {
  if (this.analytics.totalExecutions === 0) return 0;
  return ((this.analytics.successfulExecutions / this.analytics.totalExecutions) * 100).toFixed(2);
});

// Virtual for recent activity status
integrationSchema.virtual('status').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.isPaused) return 'paused';
  
  const lastExecution = this.analytics.lastExecutionAt;
  if (!lastExecution) return 'never_executed';
  
  const hoursSinceLastExecution = (Date.now() - lastExecution.getTime()) / (1000 * 60 * 60);
  if (hoursSinceLastExecution > 24) return 'stale';
  
  return 'active';
});

// Indexes for performance
integrationSchema.index({ formId: 1, isActive: 1 });
integrationSchema.index({ workspaceId: 1, type: 1 });
integrationSchema.index({ userId: 1, createdAt: -1 });
integrationSchema.index({ type: 1, isActive: 1 });
integrationSchema.index({ 'analytics.lastExecutionAt': -1 });

// Pre-save middleware for encryption
integrationSchema.pre('save', function(next) {
  // Generate encryption key if not exists
  if (this.isNew && !this.encryptionKey) {
    this.encryptionKey = crypto.randomBytes(32).toString('hex');
  }
  
  // Encrypt sensitive credentials (implement encryption logic here)
  // This is a placeholder - in production, use proper encryption
  if (this.credentials && this.isModified('credentials')) {
    // Encrypt sensitive fields like apiKey, secretKey, accessToken, etc.
    // Example: this.credentials.apiKey = encrypt(this.credentials.apiKey, this.encryptionKey);
  }
  
  next();
});

// Static method to find active integrations for form
integrationSchema.statics.findActiveForForm = function(formId, eventType = null) {
  const query = {
    formId,
    isActive: true,
    isPaused: false
  };
  
  if (eventType) {
    query['triggers.event'] = eventType;
    query['triggers.isActive'] = true;
  }
  
  return this.find(query);
};

// Static method to find workspace integrations
integrationSchema.statics.findByWorkspace = function(workspaceId, options = {}) {
  const query = { workspaceId };
  if (options.type) query.type = options.type;
  if (options.isActive !== undefined) query.isActive = options.isActive;
  
  return this.find(query).sort({ createdAt: -1 });
};

// Instance method to execute integration
integrationSchema.methods.execute = async function(data, eventType) {
  const startTime = Date.now();
  
  try {
    // Check if integration should execute for this event
    const shouldExecute = this.triggers.some(trigger => 
      trigger.event === eventType && 
      trigger.isActive && 
      this.evaluateConditions(trigger.conditions, data)
    );
    
    if (!shouldExecute) {
      return { success: true, skipped: true, reason: 'Conditions not met' };
    }
    
    // Check rate limits
    if (await this.isRateLimited()) {
      throw new Error('Rate limit exceeded');
    }
    
    let result;
    
    // Execute based on integration type
    switch (this.type) {
      case 'webhook':
        result = await this.executeWebhook(data);
        break;
      case 'google_sheets':
        result = await this.executeGoogleSheets(data);
        break;
      case 'slack':
        result = await this.executeSlack(data);
        break;
      case 'stripe':
        result = await this.executeStripe(data);
        break;
      case 'email':
        result = await this.executeEmail(data);
        break;
      default:
        throw new Error(`Integration type ${this.type} not implemented`);
    }
    
    // Update analytics
    const responseTime = Date.now() - startTime;
    await this.updateAnalytics(true, responseTime);
    
    return { success: true, result };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await this.updateAnalytics(false, responseTime, error.message);
    throw error;
  }
};

// Instance method to evaluate conditions
integrationSchema.methods.evaluateConditions = function(conditions, data) {
  if (!conditions || !conditions.fieldConditions) return true;
  
  return conditions.fieldConditions.every(condition => {
    const fieldValue = data.responses[condition.fieldId];
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return fieldValue && fieldValue.includes(condition.value);
      case 'not_contains':
        return !fieldValue || !fieldValue.includes(condition.value);
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'is_empty':
        return !fieldValue || fieldValue === '';
      case 'is_not_empty':
        return fieldValue && fieldValue !== '';
      default:
        return true;
    }
  });
};

// Instance method to check rate limits
integrationSchema.methods.isRateLimited = async function() {
  // Implement rate limiting logic
  // This would check recent executions against the rate limits
  return false; // Placeholder
};

// Instance method to update analytics
integrationSchema.methods.updateAnalytics = async function(success, responseTime, error = null) {
  this.analytics.totalExecutions += 1;
  this.analytics.lastExecutionAt = new Date();
  
  if (success) {
    this.analytics.successfulExecutions += 1;
    this.analytics.lastSuccessAt = new Date();
  } else {
    this.analytics.failedExecutions += 1;
    this.analytics.lastFailureAt = new Date();
    this.analytics.lastError = error;
  }
  
  // Update average response time
  const total = this.analytics.totalExecutions;
  const currentAvg = this.analytics.averageResponseTime;
  this.analytics.averageResponseTime = ((currentAvg * (total - 1)) + responseTime) / total;
  
  // Update uptime percentage
  this.analytics.uptime = (this.analytics.successfulExecutions / this.analytics.totalExecutions) * 100;
  
  return this.save();
};

// Placeholder methods for integration execution (to be implemented)
integrationSchema.methods.executeWebhook = async function(data) {
  // Implement webhook execution
  return { message: 'Webhook executed successfully' };
};

integrationSchema.methods.executeGoogleSheets = async function(data) {
  // Implement Google Sheets integration
  return { message: 'Data added to Google Sheets' };
};

integrationSchema.methods.executeSlack = async function(data) {
  // Implement Slack integration
  return { message: 'Slack notification sent' };
};

integrationSchema.methods.executeStripe = async function(data) {
  // Implement Stripe payment processing
  return { message: 'Payment processed' };
};

integrationSchema.methods.executeEmail = async function(data) {
  // Implement email notification
  return { message: 'Email sent successfully' };
};

module.exports = mongoose.model('Integration', integrationSchema);