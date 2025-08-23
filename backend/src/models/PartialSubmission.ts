import mongoose, { Schema, Document } from 'mongoose';
import { IPartialSubmission } from '../types';

export interface IPartialSubmissionDocument extends IPartialSubmission, Document {}

const PartialSubmissionSchema: Schema = new Schema({
  formId: {
    type: Schema.Types.ObjectId,
    ref: 'Form',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  responses: {
    type: Schema.Types.Mixed,
    required: true,
    default: {}
  },
  isComplete: {
    type: Boolean,
    default: false,
    index: true
  },
  progress: {
    totalFields: {
      type: Number,
      required: true,
      default: 0
    },
    answeredFields: {
      type: Number,
      required: true,
      default: 0
    },
    percentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100
    },
    missingRequiredFields: {
      type: Number,
      required: true,
      default: 0
    }
  },
  lastSavedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  metadata: {
    ipAddress: {
      type: String,
      sparse: true
    },
    userAgent: {
      type: String,
      sparse: true
    },
    screenResolution: {
      type: String,
      sparse: true
    },
    timezone: {
      type: String,
      sparse: true
    },
    language: {
      type: String,
      sparse: true
    },
    referrer: {
      type: String,
      sparse: true
    },
    saveCount: {
      type: Number,
      default: 1,
      min: 1
    },
    fieldCount: {
      type: Number,
      default: 0,
      min: 0
    },
    timeSpent: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
PartialSubmissionSchema.index({ formId: 1, sessionId: 1 }, { unique: true });
PartialSubmissionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
PartialSubmissionSchema.index({ isComplete: 1, lastSavedAt: -1 });
PartialSubmissionSchema.index({ 'progress.percentage': -1 });

// Virtual for checking if submission is expired
PartialSubmissionSchema.virtual('isExpired').get(function(this: IPartialSubmissionDocument) {
  return this.expiresAt < new Date();
});

// Virtual for time remaining
PartialSubmissionSchema.virtual('timeRemaining').get(function(this: IPartialSubmissionDocument) {
  const now = new Date();
  const remaining = this.expiresAt.getTime() - now.getTime();
  return Math.max(0, remaining);
});

// Virtual for time remaining in human readable format
PartialSubmissionSchema.virtual('timeRemainingHuman').get(function(this: IPartialSubmissionDocument) {
  const remaining = this.timeRemaining;
  if (remaining <= 0) return 'Expired';
  
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
});

// Static methods
PartialSubmissionSchema.statics.findByFormAndSession = function(formId: string, sessionId: string) {
  return this.findOne({ formId, sessionId, isComplete: false })
    .sort({ lastSavedAt: -1 });
};

PartialSubmissionSchema.statics.findActiveByForm = function(formId: string, limit: number = 10) {
  return this.find({ 
    formId, 
    isComplete: false,
    expiresAt: { $gt: new Date() }
  })
  .sort({ lastSavedAt: -1 })
  .limit(limit);
};

PartialSubmissionSchema.statics.getFormStats = function(formId: string) {
  return this.aggregate([
    {
      $match: {
        formId: new mongoose.Types.ObjectId(formId),
        isComplete: false
      }
    },
    {
      $group: {
        _id: null,
        totalPartialSubmissions: { $sum: 1 },
        averageProgress: { $avg: '$progress.percentage' },
        averageSaveCount: { $avg: '$metadata.saveCount' },
        averageTimeSpent: { $avg: '$metadata.timeSpent' },
        totalFieldsSaved: { $sum: '$metadata.fieldCount' }
      }
    }
  ]);
};

PartialSubmissionSchema.statics.cleanupExpired = function(olderThanDays: number = 30) {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() - olderThanDays);
  
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { updatedAt: { $lt: expirationDate } }
    ]
  });
};

// Instance methods
PartialSubmissionSchema.methods.updateProgress = function(formFields: any[]) {
  const totalRequiredFields = formFields.filter(field => field.required).length;
  const answeredFields = Object.keys(this.responses).filter(fieldId => {
    const value = this.responses[fieldId];
    return value !== null && value !== undefined && value !== '';
  }).length;
  
  this.progress = {
    totalFields: totalRequiredFields,
    answeredFields,
    percentage: totalRequiredFields > 0 ? (answeredFields / totalRequiredFields) * 100 : 0,
    missingRequiredFields: Math.max(0, totalRequiredFields - answeredFields)
  };
  
  return this;
};

PartialSubmissionSchema.methods.extendExpiration = function(additionalDays: number = 30) {
  const newExpirationDate = new Date();
  newExpirationDate.setDate(newExpirationDate.getDate() + additionalDays);
  this.expiresAt = newExpirationDate;
  
  return this;
};

PartialSubmissionSchema.methods.mergeResponses = function(newResponses: Record<string, any>) {
  this.responses = {
    ...this.responses,
    ...newResponses
  };
  
  this.metadata.saveCount = (this.metadata.saveCount || 0) + 1;
  this.lastSavedAt = new Date();
  
  return this;
};

// Pre-save middleware
PartialSubmissionSchema.pre('save', function(this: IPartialSubmissionDocument, next) {
  // Update lastSavedAt on every save
  this.lastSavedAt = new Date();
  
  // Ensure progress percentage is between 0 and 100
  if (this.progress && this.progress.percentage) {
    this.progress.percentage = Math.max(0, Math.min(100, this.progress.percentage));
  }
  
  // Ensure metadata fields have default values
  if (!this.metadata) {
    this.metadata = {};
  }
  if (!this.metadata.saveCount) {
    this.metadata.saveCount = 1;
  }
  if (!this.metadata.fieldCount) {
    this.metadata.fieldCount = Object.keys(this.responses || {}).length;
  }
  if (!this.metadata.timeSpent) {
    this.metadata.timeSpent = 0;
  }
  
  next();
});

// Pre-remove middleware (for cleanup logging)
PartialSubmissionSchema.pre('deleteOne', { document: true, query: false }, function(this: IPartialSubmissionDocument, next) {
  console.log(`Cleaning up partial submission ${this._id} for form ${this.formId}`);
  next();
});

const PartialSubmission = mongoose.model<IPartialSubmissionDocument>('PartialSubmission', PartialSubmissionSchema);

export default PartialSubmission;