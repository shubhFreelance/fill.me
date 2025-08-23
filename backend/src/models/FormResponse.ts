import mongoose, { Schema, Model } from 'mongoose';
import { IFormResponse, IResponseMetadata, IValidationError } from '../types';

const formResponseSchema = new Schema<IFormResponse>({
  formId: {
    type: Schema.Types.ObjectId,
    ref: 'Form',
    required: true,
    index: true
  },
  responses: {
    type: Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(responses: any) {
        return typeof responses === 'object' && responses !== null;
      },
      message: 'Responses must be an object'
    }
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  metadata: {
    referrer: String,
    screenResolution: String,
    timezone: String,
    language: String
  },
  isValid: {
    type: Boolean,
    default: true
  },
  validationErrors: [{
    fieldId: String,
    message: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual to populate form details
formResponseSchema.virtual('form', {
  ref: 'Form',
  localField: 'formId',
  foreignField: '_id',
  justOne: true
});

// Instance method to validate response against form fields
formResponseSchema.methods.validateAgainstForm = async function(): Promise<IValidationError[]> {
  const Form = mongoose.model('Form');
  const form = await Form.findById(this.formId);
  
  if (!form) {
    throw new Error('Form not found');
  }

  const errors: IValidationError[] = [];
  const responses = this.responses;

  // Check required fields
  for (const field of form.fields) {
    if (field.required && (!responses[field.id] || responses[field.id] === '')) {
      errors.push({
        fieldId: field.id,
        message: `${field.label} is required`
      });
    }

    // Validate field types
    if (responses[field.id]) {
      const value = responses[field.id];
      
      switch (field.type) {
        case 'email':
          const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
          if (!emailRegex.test(value)) {
            errors.push({
              fieldId: field.id,
              message: `${field.label} must be a valid email address`
            });
          }
          break;
          
        case 'phone':
          const phoneRegex = /^[+]?[1-9]?[0-9]{7,15}$/;
          if (!phoneRegex.test(value.replace(/\s|-|\(|\)/g, ''))) {
            errors.push({
              fieldId: field.id,
              message: `${field.label} must be a valid phone number`
            });
          }
          break;
          
        case 'url':
          try {
            new URL(value);
          } catch {
            errors.push({
              fieldId: field.id,
              message: `${field.label} must be a valid URL`
            });
          }
          break;
          
        case 'text':
        case 'textarea':
          if (field.validation) {
            if (field.validation.minLength && value.length < field.validation.minLength) {
              errors.push({
                fieldId: field.id,
                message: `${field.label} must be at least ${field.validation.minLength} characters`
              });
            }
            if (field.validation.maxLength && value.length > field.validation.maxLength) {
              errors.push({
                fieldId: field.id,
                message: `${field.label} cannot be more than ${field.validation.maxLength} characters`
              });
            }
            if (field.validation.pattern) {
              const regex = new RegExp(field.validation.pattern);
              if (!regex.test(value)) {
                errors.push({
                  fieldId: field.id,
                  message: `${field.label} format is invalid`
                });
              }
            }
          }
          break;
          
        case 'number':
          if (isNaN(Number(value))) {
            errors.push({
              fieldId: field.id,
              message: `${field.label} must be a valid number`
            });
          }
          break;
      }
    }
  }

  this.validationErrors = errors;
  this.isValid = errors.length === 0;
  
  return errors;
};

// Static method to get analytics for a form
formResponseSchema.statics.getAnalytics = async function(formId: string, dateRange?: { start: Date; end: Date }) {
  try {
    const matchStage: any = { 
      formId: new mongoose.Types.ObjectId(formId),
      isValid: true 
    };
    
    if (dateRange) {
      matchStage.submittedAt = {
        $gte: dateRange.start,
        $lte: dateRange.end
      };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalResponses: { $sum: 1 },
          latestResponse: { $max: '$submittedAt' },
          oldestResponse: { $min: '$submittedAt' },
          averageCompletionTime: { $avg: '$completionTime' }
        }
      }
    ];

    const result = await this.aggregate(pipeline);
    
    if (result.length === 0) {
      return {
        totalResponses: 0,
        latestResponse: null,
        oldestResponse: null,
        averageCompletionTime: 0
      };
    }

    return result[0];
  } catch (error) {
    console.error('Error in getAnalytics:', error);
    return {
      totalResponses: 0,
      latestResponse: null,
      oldestResponse: null,
      averageCompletionTime: 0
    };
  }
};

// Static method to get responses with pagination
formResponseSchema.statics.getFormResponses = async function(
  formId: string, 
  options: { page?: number; limit?: number; sort?: any; filter?: any } = {}
) {
  const {
    page = 1,
    limit = 10,
    sort = { submittedAt: -1 },
    filter = {}
  } = options;

  const query = { 
    formId: new mongoose.Types.ObjectId(formId),
    isValid: true,
    ...filter
  };

  return this.find(query)
    .sort(sort)
    .limit(limit)
    .skip((page - 1) * limit)
    .populate('form', 'title fields')
    .exec();
};

// Static method to export responses to CSV format
formResponseSchema.statics.exportToCSV = async function(formId: string, options: any = {}) {
  const Form = mongoose.model('Form');
  const form = await Form.findById(formId);
  
  if (!form) {
    throw new Error('Form not found');
  }

  const responses = await this.find({ 
    formId: new mongoose.Types.ObjectId(formId),
    isValid: true 
  }).sort({ submittedAt: -1 });

  const headers = ['Submission ID', 'Submitted At', 'IP Address'];
  
  // Add form field headers
  form.fields.forEach((field: any) => {
    headers.push(field.label);
  });

  const csvData = responses.map((response: any) => {
    const row: any[] = [
      response._id.toString(),
      response.submittedAt.toISOString(),
      response.ipAddress || ''
    ];

    // Add field responses
    form.fields.forEach((field: any) => {
      const value = response.responses[field.id];
      if (Array.isArray(value)) {
        row.push(value.join(', '));
      } else if (typeof value === 'object' && value !== null) {
        row.push(JSON.stringify(value));
      } else {
        row.push(value || '');
      }
    });

    return row;
  });

  return {
    headers,
    data: csvData
  };
};

// Middleware to increment form submissions count
formResponseSchema.post('save', async function(doc, next) {
  // Only increment for new, valid responses
  if (doc.isNew && doc.isValid) {
    try {
      const Form = mongoose.model('Form');
      const result = await Form.findByIdAndUpdate(
        doc.formId,
        { $inc: { 'analytics.submissions': 1 } },
        { new: true, upsert: false }
      );
      
      if (result) {
        console.log(`✅ Analytics updated for form ${doc.formId}: submissions now ${result.analytics.submissions}`);
      } else {
        console.log(`⚠️ Form ${doc.formId} not found for analytics update`);
      }
    } catch (error) {
      console.error('❌ Error incrementing form submissions:', error);
      // Don't fail the save operation even if analytics update fails
    }
  }
  
  if (next) next();
});

// Indexes for performance
formResponseSchema.index({ formId: 1, submittedAt: -1 });
formResponseSchema.index({ submittedAt: -1 });
formResponseSchema.index({ isValid: 1 });
formResponseSchema.index({ formId: 1, isValid: 1 });

// Interface for the FormResponse model
interface IFormResponseModel extends Model<IFormResponse> {
  getAnalytics(formId: string, dateRange?: { start: Date; end: Date }): Promise<any>;
  getFormResponses(formId: string, options?: any): Promise<IFormResponse[]>;
  exportToCSV(formId: string, options?: any): Promise<{ headers: string[]; data: any[][] }>;
}

const FormResponse = mongoose.model<IFormResponse, IFormResponseModel>('FormResponse', formResponseSchema);

export default FormResponse;