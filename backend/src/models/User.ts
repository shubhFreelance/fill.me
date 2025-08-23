import mongoose, { Schema, Model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  IUser,
  IApiKey,
  ISubscription,
  IUserPreferences,
  IUserProfile,
  IUserSecurity,
  IUserUsage,
  IUserAnalytics,
  IEmailNotifications,
  IDashboardPreferences,
  IAddress,
  ISocialLinks,
  ISubscriptionFeatures,
  IApiPermissions,
  IRateLimit,
  IApiUsageStats
} from '../types';

// API Key schema
const apiKeySchema = new Schema<IApiKey>({
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
const subscriptionSchema = new Schema<ISubscription>({
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
const preferencesSchema = new Schema<IUserPreferences>({
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

// Main user schema
const userSchema = new Schema<IUser>({
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
userSchema.virtual('fullName').get(function(this: IUser): string {
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
  } catch (error: any) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.matchPassword = async function(enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to get public profile
userSchema.methods.getPublicProfile = function(): Partial<IUser> {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpire;
  delete userObject.security.twoFactorSecret;
  delete userObject.security.backupCodes;
  return userObject;
};

// Update lastLogin on successful login
userSchema.methods.updateLastLogin = function(): Promise<IUser> {
  this.lastLogin = new Date();
  this.analytics.totalLogins += 1;
  if (!this.analytics.firstLoginAt) {
    this.analytics.firstLoginAt = new Date();
  }
  return this.save({ validateBeforeSave: false });
};

// Generate API key
userSchema.methods.generateApiKey = function(name: string, permissions: Partial<IApiPermissions> = {}): Promise<string> {
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
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000
    },
    isActive: true,
    usageStats: {
      totalRequests: 0
    },
    createdAt: new Date()
  } as IApiKey);
  
  return this.save().then(() => apiKey);
};

// Validate API key
userSchema.methods.validateApiKey = function(providedKey: string): IApiKey | null {
  const hashedProvidedKey = crypto.createHash('sha256').update(providedKey).digest('hex');
  
  const apiKey = this.apiKeys.find((key: IApiKey) => 
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
  
  return apiKey || null;
};

// Check if user has specific feature
userSchema.methods.hasFeature = function(featureName: keyof ISubscriptionFeatures): boolean {
  return this.subscription.features[featureName] === true;
};

// Check usage limits
userSchema.methods.checkUsageLimit = function(limitType: 'forms' | 'responses' | 'storage'): boolean {
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
userSchema.methods.updateUsage = function(type: 'forms' | 'responses' | 'storage', amount: number = 1): Promise<IUser> {
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

// Static method to find user by email
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method for API key authentication
userSchema.statics.authenticateApiKey = async function(providedKey: string) {
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

// Interface for the User model
interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  authenticateApiKey(providedKey: string): Promise<{ user: IUser; apiKey: IApiKey } | null>;
}

const User = mongoose.model<IUser, IUserModel>('User', userSchema);

export default User;