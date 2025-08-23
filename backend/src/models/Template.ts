import mongoose, { Schema, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { v4 as uuidv4 } from 'uuid';
import {
  ITemplate,
  ITemplateAnalytics,
  ITemplateFormData,
  ITemplateSettings,
  ITemplateRating,
  TemplateCategory,
  IFormField,
  IFormCustomization
} from '../types';

// Form field schema (duplicated to avoid circular dependency)
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
    ]
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
  conditional: {
    show: {
      enabled: { type: Boolean, default: false },
      conditions: [Schema.Types.Mixed]
    },
    skip: {
      enabled: { type: Boolean, default: false },
      targetFieldId: String,
      conditions: [Schema.Types.Mixed]
    }
  },
  answerRecall: {
    enabled: { type: Boolean, default: false },
    sourceFieldId: String,
    template: String
  },
  calculation: {
    enabled: { type: Boolean, default: false },
    formula: String,
    dependencies: [String],
    displayType: {
      type: String,
      enum: ['currency', 'percentage', 'number', 'decimal'],
      default: 'number'
    }
  },
  prefill: {
    enabled: { type: Boolean, default: false },
    urlParameter: String,
    defaultValue: Schema.Types.Mixed
  },
  properties: {
    ratingScale: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 5 },
      step: { type: Number, default: 1 },
      labels: {
        start: String,
        end: String
      }
    },
    scale: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 10 },
      step: { type: Number, default: 1 },
      leftLabel: String,
      rightLabel: String
    },
    matrix: {
      rows: [String],
      columns: [String],
      allowMultiple: { type: Boolean, default: false }
    },
    payment: {
      amount: Number,
      currency: { type: String, default: 'usd' },
      description: String,
      allowCustomAmount: { type: Boolean, default: false }
    },
    address: {
      includeCountry: { type: Boolean, default: true },
      includeState: { type: Boolean, default: true },
      includePostalCode: { type: Boolean, default: true },
      defaultCountry: String
    },
    fileUpload: {
      maxFileSize: { type: Number, default: 10 },
      allowedTypes: [String],
      maxFiles: { type: Number, default: 1 }
    },
    media: {
      url: String,
      caption: String,
      alt: String,
      autoplay: { type: Boolean, default: false }
    }
  }
}, { _id: false });

// Form customization schema (duplicated to avoid circular dependency)
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

// Template analytics schema
const templateAnalyticsSchema = new Schema<ITemplateAnalytics>({
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUsed: {
    type: Date
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  ratingCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRatings: {
    type: Number,
    default: 0,
    min: 0
  },
  views: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

// Template rating schema
const templateRatingSchema = new Schema<ITemplateRating>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Template schema
const templateSchema = new Schema<ITemplate>({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Template description is required'],
    trim: true,
    maxlength: [500, 'Template description cannot be more than 500 characters']
  },
  category: {
    type: String,
    required: true,
    enum: [
      'contact', 'survey', 'quiz', 'feedback', 'registration', 
      'application', 'booking', 'order', 'evaluation', 'newsletter',
      'event', 'support', 'assessment', 'lead-generation', 'custom'
    ] as TemplateCategory[]
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot be more than 30 characters']
  }],
  previewImage: {
    type: String,
    trim: true
  },
  thumbnailImage: {
    type: String,
    trim: true
  },
  // Form structure
  formData: {
    title: {
      type: String,
      required: true,
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
        message: 'Template must have at least one field'
      }
    },
    customization: {
      type: customizationSchema,
      default: () => ({})
    },
    settings: {
      showProgressBar: {
        type: Boolean,
        default: false
      },
      allowMultipleSubmissions: {
        type: Boolean,
        default: true
      },
      collectEmail: {
        type: Boolean,
        default: false
      },
      requireLogin: {
        type: Boolean,
        default: false
      }
    }
  },
  // Template metadata
  isOfficial: {
    type: Boolean,
    default: false // Official templates created by platform
  },
  isPremium: {
    type: Boolean,
    default: false // Premium templates for pro users
  },
  isPublic: {
    type: Boolean,
    default: true // Public templates visible to all users
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Creator information
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  createdByName: {
    type: String,
    trim: true
  },
  // Analytics and tracking
  analytics: {
    type: templateAnalyticsSchema,
    default: () => ({})
  },
  // Version control
  version: {
    type: String,
    default: '1.0.0'
  },
  publishedAt: {
    type: Date
  },
  // User ratings
  ratings: [templateRatingSchema]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for popularity score
templateSchema.virtual('popularityScore').get(function(this: ITemplate): number {
  // Calculate popularity based on usage count, rating, and recency
  const usageWeight = 0.4;
  const ratingWeight = 0.4;
  const recencyWeight = 0.2;
  
  const usage = Math.min(this.analytics.usageCount / 100, 1); // Normalize to 0-1
  const rating = this.analytics.averageRating / 5; // Already 0-1
  const daysSinceCreated = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const recency = Math.max(0, 1 - (daysSinceCreated / 365)); // Newer is better
  
  return (usage * usageWeight + rating * ratingWeight + recency * recencyWeight) * 100;
});

// Virtual for usage statistics
templateSchema.virtual('usageStats', {
  ref: 'Form',
  localField: '_id',
  foreignField: 'templateId',
  count: true
});

// Indexes for performance
templateSchema.index({ category: 1, isPublic: 1, isActive: 1 });
templateSchema.index({ tags: 1 });
templateSchema.index({ 'analytics.usageCount': -1 });
templateSchema.index({ 'analytics.averageRating': -1 });
templateSchema.index({ createdAt: -1 });
templateSchema.index({ isPremium: 1, isOfficial: 1 });
templateSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Static method to get popular templates
templateSchema.statics.getPopularTemplates = function(limit: number = 10, category?: TemplateCategory) {
  const query: any = { isPublic: true, isActive: true };
  if (category) query.category = category;
  
  return this.find(query)
    .sort({ 'analytics.usageCount': -1, 'analytics.averageRating': -1 })
    .limit(limit)
    .populate('createdBy', 'firstName lastName email');
};

// Static method to get templates by category
templateSchema.statics.getByCategory = function(category: TemplateCategory, options: any = {}) {
  const query = { category, isPublic: true, isActive: true };
  const sort = options.sort || { 'analytics.usageCount': -1 };
  const limit = options.limit || 0;
  
  return this.find(query)
    .sort(sort)
    .limit(limit)
    .populate('createdBy', 'firstName lastName email');
};

// Static method to search templates
templateSchema.statics.searchTemplates = function(searchTerm: string, options: any = {}) {
  const query = {
    $and: [
      { isPublic: true, isActive: true },
      {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { tags: { $in: [new RegExp(searchTerm, 'i')] } },
          { category: { $regex: searchTerm, $options: 'i' } }
        ]
      }
    ]
  };
  
  return this.find(query)
    .sort(options.sort || { 'analytics.usageCount': -1 })
    .limit(options.limit || 20)
    .populate('createdBy', 'firstName lastName email');
};

// Instance method to increment usage count
templateSchema.methods.incrementUsage = function(): Promise<ITemplate> {
  this.analytics.usageCount += 1;
  this.analytics.lastUsed = new Date();
  return this.save({ validateBeforeSave: false });
};

// Instance method to add rating
templateSchema.methods.addRating = function(rating: number): Promise<ITemplate> {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  
  const currentTotal = this.analytics.averageRating * this.analytics.ratingCount;
  this.analytics.ratingCount += 1;
  this.analytics.averageRating = (currentTotal + rating) / this.analytics.ratingCount;
  
  return this.save({ validateBeforeSave: false });
};

// Instance method to create form from template
templateSchema.methods.createFormFromTemplate = function(userId: string, customizations: any = {}) {
  const Form = mongoose.model('Form');
  
  const formData = {
    title: customizations.title || this.formData.title,
    description: customizations.description || this.formData.description,
    fields: this.formData.fields,
    customization: { ...this.formData.customization, ...customizations.customization },
    userId: userId,
    templateId: this._id,
    isPublic: customizations.isPublic !== undefined ? customizations.isPublic : true
  };
  
  // Increment usage count
  this.incrementUsage();
  
  return new Form(formData);
};

// Pre-save middleware
templateSchema.pre('save', function(next) {
  if (this.isNew && this.isOfficial && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// Add pagination plugin
templateSchema.plugin(mongoosePaginate);

// Interface for the Template model
interface ITemplateModel extends Model<ITemplate> {
  getPopularTemplates(limit?: number, category?: TemplateCategory): Promise<ITemplate[]>;
  getByCategory(category: TemplateCategory, options?: any): Promise<ITemplate[]>;
  searchTemplates(searchTerm: string, options?: any): Promise<ITemplate[]>;
}

const Template = mongoose.model<ITemplate, ITemplateModel>('Template', templateSchema);

export default Template;
export { templateAnalyticsSchema };