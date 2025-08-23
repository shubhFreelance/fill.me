const mongoose = require('mongoose');

const formResponseSchema = new mongoose.Schema({
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    required: true,
    index: true
  },
  responses: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(responses) {
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
formResponseSchema.methods.validateAgainstForm = async function() {
  const Form = mongoose.model('Form');
  const form = await Form.findById(this.formId);
  
  if (!form) {
    throw new Error('Form not found');
  }

  const errors = [];
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
                message: `${field.label} cannot exceed ${field.validation.maxLength} characters`
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
          
        case 'dropdown':
        case 'radio':
          if (field.options && !field.options.includes(value)) {
            errors.push({
              fieldId: field.id,
              message: `${field.label} contains an invalid option`
            });
          }
          break;
          
        case 'checkbox':
          if (field.options && Array.isArray(value)) {
            const invalidOptions = value.filter(v => !field.options.includes(v));
            if (invalidOptions.length > 0) {
              errors.push({
                fieldId: field.id,
                message: `${field.label} contains invalid options: ${invalidOptions.join(', ')}`
              });
            }
          }
          break;
          
        case 'date':
          if (isNaN(Date.parse(value))) {
            errors.push({
              fieldId: field.id,
              message: `${field.label} must be a valid date`
            });
          }
          break;
      }
    }
  }

  this.validationErrors = errors;
  this.isValid = errors.length === 0;
  
  return this.isValid;
};

// Instance method to get formatted response data
formResponseSchema.methods.getFormattedData = function() {
  return {
    id: this._id,
    formId: this.formId,
    responses: this.responses,
    submittedAt: this.submittedAt,
    isValid: this.isValid,
    validationErrors: this.validationErrors
  };
};

// Static method to get responses for a form
formResponseSchema.statics.getFormResponses = function(formId, options = {}) {
  const query = { formId, isValid: true };
  
  if (options.startDate) {
    query.submittedAt = { $gte: new Date(options.startDate) };
  }
  
  if (options.endDate) {
    query.submittedAt = { 
      ...query.submittedAt, 
      $lte: new Date(options.endDate) 
    };
  }

  return this.find(query)
    .sort(options.sort || { submittedAt: -1 })
    .limit(options.limit || 0)
    .skip(options.skip || 0);
};

// Static method to get response analytics
formResponseSchema.statics.getAnalytics = async function(formId) {
  try {
    const pipeline = [
      { $match: { formId: new mongoose.Types.ObjectId(formId), isValid: true } },
      {
        $group: {
          _id: null,
          totalResponses: { $sum: 1 },
          latestResponse: { $max: '$submittedAt' },
          oldestResponse: { $min: '$submittedAt' }
        }
      }
    ];

    const result = await this.aggregate(pipeline);
    return result[0] || {
      totalResponses: 0,
      latestResponse: null,
      oldestResponse: null
    };
  } catch (error) {
    console.error('Error in getAnalytics:', error);
    return {
      totalResponses: 0,
      latestResponse: null,
      oldestResponse: null
    };
  }
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

module.exports = mongoose.model('FormResponse', formResponseSchema);