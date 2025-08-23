const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// API Key schema
const apiKeySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'API key name is required'],
    trim: true,
    maxlength: [100, 'API key name cannot be more than 100 characters']
  },
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  hashedKey: {
    type: String,
    required: true
  },
  permissions: {
    forms: {
      read: { type: Boolean, default: true },
      write: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    responses: {
      read: { type: Boolean, default: true },
      write: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    analytics: {
      read: { type: Boolean, default: true }
    },
    integrations: {
      read: { type: Boolean, default: false },
      write: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    }
  },
  rateLimit: {
    requestsPerMinute: {
      type: Number,
      default: 60
    },
    requestsPerHour: {
      type: Number,
      default: 1000
    },
    requestsPerDay: {
      type: Number,
      default: 10000
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: Date,
  usageStats: {
    totalRequests: {
      type: Number,
      default: 0
    },
    lastRequestAt: Date,
    lastRequestIp: String
  },
  expiresAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Subscription schema
const subscriptionSchema = new mongoose.Schema({
  plan: {
    type: String,
    enum: ['free', 'starter', 'professional', 'enterprise'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['active', 'past_due', 'canceled', 'trialing'],
    default: 'active'
  },
  stripeSubscriptionId: String,
  stripeCustomerId: String,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  trialStart: Date,
  trialEnd: Date,
  canceledAt: Date,
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  features: {
    maxForms: {
      type: Number,
      default: 3
    },
    maxResponses: {
      type: Number,
      default: 100
    },
    maxFileStorage: {
      type: Number,
      default: 100 // MB
    },
    customBranding: {
      type: Boolean,
      default: false
    },
    advancedAnalytics: {
      type: Boolean,
      default: false
    },
    integrations: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    },
    customDomains: {
      type: Boolean,
      default: false
    },
    whiteLabeling: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
    }
  }
}, { _id: false });

// Preferences schema
const preferencesSchema = new mongoose.Schema({
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'light'
  },
  language: {
    type: String,
    default: 'en'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  emailNotifications: {
    formSubmissions: {
      type: Boolean,
      default: true
    },
    weeklyReports: {
      type: Boolean,
      default: true
    },
    productUpdates: {
      type: Boolean,
      default: true
    },
    marketingEmails: {
      type: Boolean,
      default: false
    }
  },
  dashboard: {
    defaultView: {
      type: String,
      enum: ['forms', 'analytics', 'templates'],
      default: 'forms'
    },
    itemsPerPage: {
      type: Number,
      default: 10
    }
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in queries by default
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot be more than 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot be more than 50 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  // Pro features and subscription
  subscription: {
    type: subscriptionSchema,
    default: () => ({})
  },
  // API keys for external access
  apiKeys: [apiKeySchema],
  // User preferences
  preferences: {
    type: preferencesSchema,
    default: () => ({})
  },
  // Profile information
  profile: {
    avatar: String,
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot be more than 500 characters']
    },
    website: String,
    company: String,
    jobTitle: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    socialLinks: {
      twitter: String,
      linkedin: String,
      github: String
    }
  },
  // Security settings
  security: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: String,
    backupCodes: [String],
    lastPasswordChange: {
      type: Date,
      default: Date.now
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    ipWhitelist: [String],
    sessionTimeout: {
      type: Number,
      default: 24 // hours
    }
  },
  // Usage statistics
  usage: {
    formsCreated: {
      type: Number,
      default: 0
    },
    responsesReceived: {
      type: Number,
      default: 0
    },
    storageUsed: {
      type: Number,
      default: 0 // in MB
    },
    apiCallsThisMonth: {
      type: Number,
      default: 0
    },
    lastApiCall: Date
  },
  // Admin and system fields
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationExpire: Date,
  // Tracking and analytics
  analytics: {
    signupSource: String,
    referralCode: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    firstLoginAt: Date,
    totalLogins: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Virtual for form count
userSchema.virtual('formCount', {
  ref: 'Form',
  localField: '_id',
  foreignField: 'userId',
  count: true
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to get public profile
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpire;
  return userObject;
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Update lastLogin on successful login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.analytics.totalLogins += 1;
  if (!this.analytics.firstLoginAt) {
    this.analytics.firstLoginAt = new Date();
  }
  return this.save({ validateBeforeSave: false });
};

// Generate API key
userSchema.methods.generateApiKey = function(name, permissions = {}) {
  if (!this.hasFeature('apiAccess')) {
    throw new Error('API access not available in current plan');
  }
  
  const apiKey = crypto.randomBytes(32).toString('hex');
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  this.apiKeys.push({
    name,
    key: apiKey.substring(0, 8) + '...' + apiKey.substring(-4), // Store partial key for display
    hashedKey,
    permissions: {
      forms: { read: true, write: false, delete: false },
      responses: { read: true, write: false, delete: false },
      analytics: { read: true },
      integrations: { read: false, write: false, delete: false },
      ...permissions
    },
    isActive: true
  });
  
  return this.save().then(() => apiKey);
};

// Validate API key
userSchema.methods.validateApiKey = function(providedKey) {
  const hashedProvidedKey = crypto.createHash('sha256').update(providedKey).digest('hex');
  
  const apiKey = this.apiKeys.find(key => 
    key.hashedKey === hashedProvidedKey && 
    key.isActive && 
    (!key.expiresAt || key.expiresAt > new Date())
  );
  
  if (apiKey) {
    // Update usage stats
    apiKey.lastUsed = new Date();
    apiKey.usageStats.totalRequests += 1;
    apiKey.usageStats.lastRequestAt = new Date();
    this.usage.apiCallsThisMonth += 1;
    this.usage.lastApiCall = new Date();
    this.save({ validateBeforeSave: false });
  }
  
  return apiKey;
};

// Revoke API key
userSchema.methods.revokeApiKey = function(keyId) {
  const apiKey = this.apiKeys.id(keyId);
  if (apiKey) {
    apiKey.isActive = false;
    return this.save();
  }
  throw new Error('API key not found');
};

// Check if user has specific feature
userSchema.methods.hasFeature = function(featureName) {
  return this.subscription.features[featureName] === true;
};

// Check usage limits
userSchema.methods.checkUsageLimit = function(limitType) {
  const limits = this.subscription.features;
  const usage = this.usage;
  
  switch (limitType) {
    case 'forms':
      return usage.formsCreated >= limits.maxForms;
    case 'responses':
      return usage.responsesReceived >= limits.maxResponses;
    case 'storage':
      return usage.storageUsed >= limits.maxFileStorage;
    default:
      return false;
  }
};

// Update usage statistics
userSchema.methods.updateUsage = function(type, amount = 1) {
  switch (type) {
    case 'forms':
      this.usage.formsCreated += amount;
      break;
    case 'responses':
      this.usage.responsesReceived += amount;
      break;
    case 'storage':
      this.usage.storageUsed += amount;
      break;
  }
  return this.save({ validateBeforeSave: false });
};

// Upgrade subscription
userSchema.methods.upgradeSubscription = function(newPlan, stripeSubscriptionId) {
  const planFeatures = {
    free: {
      maxForms: 3,
      maxResponses: 100,
      maxFileStorage: 100,
      customBranding: false,
      advancedAnalytics: false,
      integrations: false,
      apiAccess: false,
      customDomains: false,
      whiteLabeling: false,
      prioritySupport: false
    },
    starter: {
      maxForms: 10,
      maxResponses: 1000,
      maxFileStorage: 500,
      customBranding: true,
      advancedAnalytics: true,
      integrations: true,
      apiAccess: false,
      customDomains: false,
      whiteLabeling: false,
      prioritySupport: false
    },
    professional: {
      maxForms: 50,
      maxResponses: 10000,
      maxFileStorage: 2000,
      customBranding: true,
      advancedAnalytics: true,
      integrations: true,
      apiAccess: true,
      customDomains: true,
      whiteLabeling: false,
      prioritySupport: true
    },
    enterprise: {
      maxForms: -1, // unlimited
      maxResponses: -1,
      maxFileStorage: -1,
      customBranding: true,
      advancedAnalytics: true,
      integrations: true,
      apiAccess: true,
      customDomains: true,
      whiteLabeling: true,
      prioritySupport: true
    }
  };
  
  this.subscription.plan = newPlan;
  this.subscription.features = planFeatures[newPlan];
  this.subscription.stripeSubscriptionId = stripeSubscriptionId;
  this.subscription.status = 'active';
  
  return this.save();
};

// Enable two-factor authentication
userSchema.methods.enableTwoFactor = function(secret, backupCodes) {
  this.security.twoFactorEnabled = true;
  this.security.twoFactorSecret = secret;
  this.security.backupCodes = backupCodes;
  return this.save();
};

// Disable two-factor authentication
userSchema.methods.disableTwoFactor = function() {
  this.security.twoFactorEnabled = false;
  this.security.twoFactorSecret = undefined;
  this.security.backupCodes = [];
  return this.save();
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { 'security.lockUntil': 1 },
      $set: { 'security.loginAttempts': 1 }
    });
  }
  
  const updates = { $inc: { 'security.loginAttempts': 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.security.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { 'security.lockUntil': Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      'security.loginAttempts': 1,
      'security.lockUntil': 1
    }
  });
};

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ 'subscription.status': 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'apiKeys.hashedKey': 1 });
userSchema.index({ 'apiKeys.isActive': 1 });
userSchema.index({ verificationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });

// Static method to find users by subscription plan
userSchema.statics.findByPlan = function(plan) {
  return this.find({ 'subscription.plan': plan, isActive: true });
};

// Static method to find users with expiring trials
userSchema.statics.findExpiringTrials = function(days = 7) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  
  return this.find({
    'subscription.status': 'trialing',
    'subscription.trialEnd': { $lte: expiryDate },
    isActive: true
  });
};

// Static method to find users with failed payments
userSchema.statics.findFailedPayments = function() {
  return this.find({
    'subscription.status': 'past_due',
    isActive: true
  });
};

// Static method for API key authentication
userSchema.statics.authenticateApiKey = async function(providedKey) {
  const hashedProvidedKey = crypto.createHash('sha256').update(providedKey).digest('hex');
  
  const user = await this.findOne({
    'apiKeys.hashedKey': hashedProvidedKey,
    'apiKeys.isActive': true,
    isActive: true
  });
  
  if (user) {
    const apiKey = user.validateApiKey(providedKey);
    return { user, apiKey };
  }
  
  return null;
};

// Static method to get usage statistics
userSchema.statics.getUsageStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$subscription.plan',
        totalUsers: { $sum: 1 },
        totalForms: { $sum: '$usage.formsCreated' },
        totalResponses: { $sum: '$usage.responsesReceived' },
        totalStorage: { $sum: '$usage.storageUsed' }
      }
    }
  ]);
  
  return stats;
};

module.exports = mongoose.model('User', userSchema);