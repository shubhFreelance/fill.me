import mongoose, { Schema, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { v4 as uuidv4 } from 'uuid';
import {
  IForm,
  IFormField,
  IFormCustomization,
  IFormAnalytics,
  IFormSettings,
  IThankYouPage,
  IPaymentSettings,
  ILanguageSettings,
  ISeoSettings,
  IConditionalLogic,
  IAnswerRecall,
  ICalculation,
  IPrefillSettings,
  IFieldProperties,
  FormFieldType,
  ICondition,
  INotificationSettings,
  IAutoSaveSettings,
  IPasswordProtection,
  IResponseLimit,
  IScheduleSettings,
  IGdprSettings,
  ILanguage,
  IRatingScale,
  IScale,
  IMatrix,
  IFieldPayment,
  IAddressField,
  IFileUpload,
  IMediaField,
  IDeviceStats
} from '../types';

// Form field schema
const formFieldSchema = new Schema<IFormField>({
  id: {
    type: String,
    default: uuidv4,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'text', 'textarea', 'email', 'dropdown', 'radio', 'checkbox', 'date', 'file',
      'number', 'phone', 'url', 'rating', 'scale', 'matrix', 'signature', 'payment',
      'address', 'name', 'password', 'hidden', 'divider', 'heading', 'paragraph',
      'image', 'video', 'audio', 'calendar'
    ] as FormFieldType[]
  },
  label: {
    type: String,
    required: [true, 'Field label is required'],
    trim: true,
    maxlength: [200, 'Field label cannot be more than 200 characters']
  },
  placeholder: {
    type: String,
    trim: true,
    maxlength: [200, 'Placeholder cannot be more than 200 characters']
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    type: String,
    trim: true,
    maxlength: [100, 'Option cannot be more than 100 characters']
  }],
  validation: {
    minLength: {
      type: Number,
      min: 0
    },
    maxLength: {
      type: Number,
      min: 0
    },
    pattern: String
  },
  order: {
    type: Number,
    default: 0
  },
  // Advanced logic features
  conditional: {
    show: {
      enabled: {
        type: Boolean,
        default: false
      },
      conditions: [{
        fieldId: String,
        operator: {
          type: String,
          enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
        },
        value: Schema.Types.Mixed,
        logicalOperator: {
          type: String,
          enum: ['and', 'or'],
          default: 'and'
        }
      }]
    },
    skip: {
      enabled: {
        type: Boolean,
        default: false
      },
      targetFieldId: String, // Field to skip to
      conditions: [{
        fieldId: String,
        operator: {
          type: String,
          enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
        },
        value: Schema.Types.Mixed
      }]
    }
  },
  // Answer recall - reference previous answers
  answerRecall: {
    enabled: {
      type: Boolean,
      default: false
    },
    sourceFieldId: String, // Field to recall answer from
    template: String // Template like "Hello {{sourceField}}, how are you?"
  },
  // Field calculations
  calculation: {
    enabled: {
      type: Boolean,
      default: false
    },
    formula: String, // Mathematical formula using field IDs
    dependencies: [String], // Array of field IDs this calculation depends on
    displayType: {
      type: String,
      enum: ['currency', 'percentage', 'number', 'decimal'],
      default: 'number'
    }
  },
  // Pre-fill settings
  prefill: {
    enabled: {
      type: Boolean,
      default: false
    },
    urlParameter: String, // URL parameter name to pull value from
    defaultValue: Schema.Types.Mixed
  },
  // Advanced field properties
  properties: {
    // For rating fields
    ratingScale: {
      min: {
        type: Number,
        default: 1
      },
      max: {
        type: Number,
        default: 5
      },
      step: {
        type: Number,
        default: 1
      },
      labels: {
        start: String,
        end: String
      }
    },
    // For scale fields
    scale: {
      min: {
        type: Number,
        default: 0
      },
      max: {
        type: Number,
        default: 10
      },
      step: {
        type: Number,
        default: 1
      },
      leftLabel: String,
      rightLabel: String
    },
    // For matrix fields
    matrix: {
      rows: [String],
      columns: [String],
      allowMultiple: {
        type: Boolean,
        default: false
      }
    },
    // For payment fields
    payment: {
      amount: Number,
      currency: {
        type: String,
        default: 'usd'
      },
      description: String,
      allowCustomAmount: {
        type: Boolean,
        default: false
      }
    },
    // For address fields
    address: {
      includeCountry: {
        type: Boolean,
        default: true
      },
      includeState: {
        type: Boolean,
        default: true
      },
      includePostalCode: {
        type: Boolean,
        default: true
      },
      defaultCountry: String
    },
    // For file upload fields
    fileUpload: {
      maxFileSize: {
        type: Number,
        default: 10 // MB
      },
      allowedTypes: [String],
      maxFiles: {
        type: Number,
        default: 1
      }
    },
    // For media fields (image, video, audio)
    media: {
      url: String,
      caption: String,
      alt: String,
      autoplay: {
        type: Boolean,
        default: false
      }
    }
  }
}, { _id: false });

// Form customization schema
const customizationSchema = new Schema<IFormCustomization>({
  primaryColor: {
    type: String,
    default: '#3b82f6',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please enter a valid hex color']
  },
  fontFamily: {
    type: String,
    default: 'Inter',
    enum: ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins']
  },
  logoUrl: {
    type: String,
    trim: true
  },
  // Enhanced customization options
  backgroundColor: {
    type: String,
    default: '#ffffff'
  },
  backgroundImage: {
    type: String,
    trim: true
  },
  theme: {
    type: String,
    enum: ['default', 'minimal', 'modern', 'classic', 'custom'],
    default: 'default'
  },
  customCss: {
    type: String,
    trim: true
  }
}, { _id: false });

// Analytics schema
const analyticsSchema = new Schema<IFormAnalytics>({
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  submissions: {
    type: Number,
    default: 0,
    min: 0
  },
  // Enhanced analytics
  starts: {
    type: Number,
    default: 0,
    min: 0
  },
  completions: {
    type: Number,
    default: 0,
    min: 0
  },
  abandons: {
    type: Number,
    default: 0,
    min: 0
  },
  averageCompletionTime: {
    type: Number,
    default: 0 // in seconds
  },
  fieldDropoffs: {
    type: Map,
    of: Number // fieldId -> dropoff count
  },
  deviceStats: {
    mobile: {
      type: Number,
      default: 0
    },
    tablet: {
      type: Number,
      default: 0
    },
    desktop: {
      type: Number,
      default: 0
    }
  },
  referrerStats: {
    type: Map,
    of: Number // referrer -> count
  }
}, { _id: false });

// Main form schema
const formSchema = new Schema<IForm>({
  title: {
    type: String,
    required: [true, 'Form title is required'],
    trim: true,
    maxlength: [200, 'Form title cannot be more than 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Form description cannot be more than 1000 characters']
  },
  fields: {
    type: [formFieldSchema],
    validate: {
      validator: function(fields: IFormField[]) {
        return fields.length > 0;
      },
      message: 'Form must have at least one field'
    }
  },
  customization: {
    type: customizationSchema,
    default: () => ({})
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  analytics: {
    type: analyticsSchema,
    default: () => ({})
  },
  publicUrl: {
    type: String,
    unique: true,
    sparse: true
  },
  embedCode: {
    type: String
  },
  templateId: {
    type: Schema.Types.ObjectId,
    ref: 'Template',
    index: true
  },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  // Advanced form settings
  settings: {
    // Multi-step form settings
    isMultiStep: {
      type: Boolean,
      default: false
    },
    showProgressBar: {
      type: Boolean,
      default: false
    },
    allowBackNavigation: {
      type: Boolean,
      default: true
    },
    // Submission settings
    allowMultipleSubmissions: {
      type: Boolean,
      default: true
    },
    requireLogin: {
      type: Boolean,
      default: false
    },
    collectIpAddress: {
      type: Boolean,
      default: true
    },
    collectUserAgent: {
      type: Boolean,
      default: true
    },
    // Notification settings
    notifications: {
      email: {
        enabled: {
          type: Boolean,
          default: false
        },
        recipients: [String],
        subject: String,
        template: String
      },
      webhook: {
        enabled: {
          type: Boolean,
          default: false
        },
        url: String,
        headers: {
          type: Map,
          of: String
        }
      }
    },
    // Auto-save settings
    autoSave: {
      enabled: {
        type: Boolean,
        default: false
      },
      interval: {
        type: Number,
        default: 30 // seconds
      }
    },
    // Password protection
    passwordProtection: {
      enabled: {
        type: Boolean,
        default: false
      },
      password: String
    },
    // Response limits
    responseLimit: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxResponses: Number
    },
    // Schedule settings
    schedule: {
      enabled: {
        type: Boolean,
        default: false
      },
      startDate: Date,
      endDate: Date,
      timezone: String
    },
    // GDPR compliance
    gdpr: {
      enabled: {
        type: Boolean,
        default: false
      },
      consentText: String,
      privacyPolicyUrl: String,
      dataRetentionDays: {
        type: Number,
        default: 0 // 0 means keep forever
      }
    }
  },
  // Thank you page settings
  thankYouPage: {
    type: {
      type: String,
      enum: ['message', 'redirect', 'custom'],
      default: 'message'
    },
    message: {
      type: String,
      default: 'Thank you for your submission!'
    },
    redirectUrl: String,
    customHtml: String,
    showConfetti: {
      type: Boolean,
      default: false
    },
    autoRedirectDelay: {
      type: Number,
      default: 0 // seconds, 0 means no auto redirect
    }
  },
  // Payment integration
  payment: {
    enabled: {
      type: Boolean,
      default: false
    },
    provider: {
      type: String,
      enum: ['stripe', 'paypal'],
      default: 'stripe'
    },
    amount: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'usd'
    },
    description: String,
    allowCustomAmount: {
      type: Boolean,
      default: false
    }
  },
  // Multi-language support
  languages: {
    default: {
      type: String,
      default: 'en'
    },
    supported: [{
      code: String,
      name: String,
      translations: {
        type: Map,
        of: String // key -> translated text
      }
    }]
  },
  // SEO settings
  seo: {
    title: String,
    description: String,
    keywords: [String],
    ogImage: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for response count
formSchema.virtual('responseCount', {
  ref: 'FormResponse',
  localField: '_id',
  foreignField: 'formId',
  count: true
});

// Virtual for conversion rate
formSchema.virtual('conversionRate').get(function(this: IForm): string {
  if (this.analytics.views === 0) return '0.00';
  return ((this.analytics.submissions / this.analytics.views) * 100).toFixed(2);
});

// Generate public URL before saving
formSchema.pre('save', function(next) {
  if (!this.publicUrl) {
    this.publicUrl = uuidv4();
  }
  
  // Generate embed code
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  this.embedCode = `<iframe src="${frontendUrl}/embed/${this.publicUrl}" width="100%" height="600" frameborder="0"></iframe>`;
  
  next();
});

// Instance method to increment views
formSchema.methods.incrementViews = function(): Promise<IForm> {
  this.analytics.views += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to increment submissions
formSchema.methods.incrementSubmissions = function(): Promise<IForm> {
  this.analytics.submissions += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to get public form data
formSchema.methods.getPublicData = function(): Partial<IForm> {
  return {
    _id: this._id,
    title: this.title,
    description: this.description,
    fields: this.fields,
    customization: this.customization,
    publicUrl: this.publicUrl,
    settings: this.settings,
    thankYouPage: this.thankYouPage,
    payment: this.payment,
    languages: this.languages
  };
};

// Instance method to evaluate conditional logic
formSchema.methods.evaluateConditionalLogic = function(fieldId: string, responses: Record<string, any>): boolean {
  const field = this.fields.find((f: IFormField) => f.id === fieldId);
  if (!field || !field.conditional.show.enabled) {
    return true; // Show by default if no conditions
  }
  
  const conditions = field.conditional.show.conditions;
  if (!conditions || conditions.length === 0) return true;
  
  return conditions.every((condition: ICondition) => {
    const value = responses[condition.fieldId];
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return value && value.includes(condition.value);
      case 'not_contains':
        return !value || !value.includes(condition.value);
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'is_empty':
        return !value || value === '';
      case 'is_not_empty':
        return value && value !== '';
      default:
        return true;
    }
  });
};

// Instance method to calculate field values
formSchema.methods.calculateFieldValue = function(fieldId: string, responses: Record<string, any>): string | null {
  const field = this.fields.find((f: IFormField) => f.id === fieldId);
  if (!field || !field.calculation.enabled) {
    return null;
  }
  
  let formula = field.calculation.formula || '';
  
  // Replace field IDs with actual values
  field.calculation.dependencies.forEach((depFieldId: string) => {
    const value = responses[depFieldId] || 0;
    formula = formula.replace(new RegExp(`{{${depFieldId}}}`, 'g'), value.toString());
  });
  
  try {
    // Basic formula evaluation (implement proper parser for production)
    const result = eval(formula);
    
    // Format based on display type
    switch (field.calculation.displayType) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(result);
      case 'percentage':
        return `${(result * 100).toFixed(2)}%`;
      case 'decimal':
        return result.toFixed(2);
      default:
        return Math.round(result).toString();
    }
  } catch (error) {
    return 'Error in calculation';
  }
};

// Static method to find by public URL
formSchema.statics.findByPublicUrl = function(publicUrl: string) {
  return this.findOne({ publicUrl, isPublic: true, isActive: true });
};

// Static method to find user forms
formSchema.statics.findUserForms = function(userId: string, options: any = {}) {
  const query = { userId, isActive: true };
  return this.find(query)
    .populate('responseCount')
    .sort(options.sort || { updatedAt: -1 })
    .limit(options.limit || 0);
};

// Indexes for performance
formSchema.index({ userId: 1, createdAt: -1 });
formSchema.index({ publicUrl: 1 });
formSchema.index({ isPublic: 1, isActive: 1 });
formSchema.index({ 'analytics.submissions': -1 });
formSchema.index({ 'analytics.views': -1 });
formSchema.index({ templateId: 1 });
formSchema.index({ workspaceId: 1 });

// Add pagination plugin
formSchema.plugin(mongoosePaginate);

// Interface for the Form model
interface IFormModel extends Model<IForm> {
  findByPublicUrl(publicUrl: string): Promise<IForm | null>;
  findUserForms(userId: string, options?: any): Promise<IForm[]>;
}

const Form = mongoose.model<IForm, IFormModel>('Form', formSchema);

export default Form;
export { formFieldSchema, customizationSchema, analyticsSchema };