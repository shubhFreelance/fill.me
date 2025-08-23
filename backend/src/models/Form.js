const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const { v4: uuidv4 } = require('uuid');

// Form field schema
const formFieldSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuidv4,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'textarea', 'email', 'dropdown', 'radio', 'checkbox', 'date', 'file']
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
  }
}, { _id: false });

// Form customization schema
const customizationSchema = new mongoose.Schema({
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
  }
}, { _id: false });

// Analytics schema
const analyticsSchema = new mongoose.Schema({
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  submissions: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

// Main form schema
const formSchema = new mongoose.Schema({
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
      validator: function(fields) {
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
    type: mongoose.Schema.Types.ObjectId,
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
formSchema.virtual('conversionRate').get(function() {
  if (this.analytics.views === 0) return 0;
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
formSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to increment submissions
formSchema.methods.incrementSubmissions = function() {
  this.analytics.submissions += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to get public form data
formSchema.methods.getPublicData = function() {
  return {
    _id: this._id,
    title: this.title,
    description: this.description,
    fields: this.fields,
    customization: this.customization,
    publicUrl: this.publicUrl
  };
};

// Static method to find by public URL
formSchema.statics.findByPublicUrl = function(publicUrl) {
  return this.findOne({ publicUrl, isPublic: true, isActive: true });
};

// Static method to find user forms
formSchema.statics.findUserForms = function(userId, options = {}) {
  const query = { userId, isActive: true };
  return this.find(query)
    .populate('responseCount')
    .sort(options.sort || { updatedAt: -1 })
    .limit(options.limit || 0);
};

// Static method to recalculate analytics for all forms
formSchema.statics.recalculateAnalytics = async function() {
  try {
    const FormResponse = mongoose.model('FormResponse');
    const forms = await this.find({ isActive: true });
    
    for (const form of forms) {
      const submissionCount = await FormResponse.countDocuments({
        formId: form._id,
        isValid: true
      });
      
      // Update the form's analytics
      await this.findByIdAndUpdate(
        form._id,
        { 'analytics.submissions': submissionCount },
        { new: true }
      );
      
      console.log(`Updated form ${form.title}: ${submissionCount} submissions`);
    }
    
    console.log('Analytics recalculation completed');
  } catch (error) {
    console.error('Error recalculating analytics:', error);
  }
};

// Static method to sync single form analytics
formSchema.statics.syncFormAnalytics = async function(formId) {
  try {
    const FormResponse = mongoose.model('FormResponse');
    const submissionCount = await FormResponse.countDocuments({
      formId: new mongoose.Types.ObjectId(formId),
      isValid: true
    });
    
    const updatedForm = await this.findByIdAndUpdate(
      formId,
      { 'analytics.submissions': submissionCount },
      { new: true }
    );
    
    console.log(`Synced form analytics: ${submissionCount} submissions`);
    return updatedForm;
  } catch (error) {
    console.error('Error syncing form analytics:', error);
    throw error;
  }
};

// Indexes for performance
formSchema.index({ userId: 1, createdAt: -1 });
formSchema.index({ publicUrl: 1 });
formSchema.index({ isPublic: 1, isActive: 1 });
formSchema.index({ 'analytics.submissions': -1 });
formSchema.index({ 'analytics.views': -1 });

// Add pagination plugin
formSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Form', formSchema);