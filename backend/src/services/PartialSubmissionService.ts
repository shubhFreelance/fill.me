import { Types } from 'mongoose';
import { IForm, IFormField, IFormResponse } from '../types';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';
import PartialSubmission from '../models/PartialSubmission';

/**
 * Partial Submission Service
 * Handles saving, retrieving, and managing incomplete form submissions
 * Allows users to return and complete forms later
 */
export class PartialSubmissionService {

  /**
   * Save partial submission data
   * @param formId - Form identifier
   * @param sessionId - User session identifier
   * @param responses - Partial response data
   * @param metadata - Additional metadata
   * @returns Saved partial submission
   */
  static async savePartialSubmission(
    formId: string,
    sessionId: string,
    responses: Record<string, any>,
    metadata: IPartialSubmissionMetadata = {}
  ): Promise<IPartialSubmissionResult> {
    try {
      // Verify form exists
      const form = await Form.findById(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      // Check if auto-save is enabled for this form
      if (!form.settings?.autoSave?.enabled) {
        throw new Error('Auto-save is not enabled for this form');
      }

      // Find existing partial submission for this session
      let existingSubmission = await this.findPartialSubmission(formId, sessionId);

      const submissionData: IPartialSubmission = {
        formId: new Types.ObjectId(formId),
        sessionId,
        responses,
        isComplete: false,
        lastSavedAt: new Date(),
        expiresAt: this.calculateExpirationDate(form.settings?.autoSave?.interval || 30),
        progress: this.calculateProgress(responses, form.fields),
        metadata: {
          ...metadata,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          screenResolution: metadata.screenResolution,
          timezone: metadata.timezone,
          language: metadata.language,
          referrer: metadata.referrer,
          saveCount: existingSubmission ? existingSubmission.metadata.saveCount + 1 : 1,
          fieldCount: Object.keys(responses).length,
          timeSpent: metadata.timeSpent || 0
        }
      };

      let savedSubmission: any;

      if (existingSubmission) {
        // Update existing partial submission
        existingSubmission.mergeResponses(responses);
        existingSubmission.updateProgress(form.fields);
        existingSubmission.extendExpiration(form.settings?.autoSave?.interval || 30);
        existingSubmission.metadata = {
          ...existingSubmission.metadata,
          ...submissionData.metadata
        };
        savedSubmission = await existingSubmission.save();
      } else {
        // Create new partial submission
        savedSubmission = new PartialSubmission({
          ...submissionData,
          _id: new Types.ObjectId()
        });
        savedSubmission.updateProgress(form.fields);
        await savedSubmission.save();
      }

      // Track analytics
      await this.trackPartialSubmissionAnalytics(formId, 'save');

      return {
        success: true,
        submissionId: savedSubmission._id.toString(),
        sessionId,
        progress: submissionData.progress,
        lastSavedAt: submissionData.lastSavedAt,
        expiresAt: submissionData.expiresAt,
        metadata: submissionData.metadata
      };
    } catch (error) {
      console.error('Error saving partial submission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Retrieve partial submission data
   * @param formId - Form identifier
   * @param sessionId - User session identifier
   * @returns Partial submission data if found
   */
  static async retrievePartialSubmission(
    formId: string,
    sessionId: string
  ): Promise<IPartialSubmissionResult> {
    try {
      const partialSubmission = await this.findPartialSubmission(formId, sessionId);

      if (!partialSubmission) {
        return {
          success: false,
          error: 'No partial submission found'
        };
      }

      // Check if submission has expired
      if (partialSubmission.expiresAt < new Date()) {
        await this.deletePartialSubmission(formId, sessionId);
        return {
          success: false,
          error: 'Partial submission has expired'
        };
      }

      // Track analytics
      await this.trackPartialSubmissionAnalytics(formId, 'retrieve');

      return {
        success: true,
        submissionId: partialSubmission._id.toString(),
        sessionId: partialSubmission.sessionId,
        responses: partialSubmission.responses,
        progress: partialSubmission.progress,
        lastSavedAt: partialSubmission.lastSavedAt,
        expiresAt: partialSubmission.expiresAt,
        metadata: partialSubmission.metadata,
        createdAt: partialSubmission.createdAt
      };
    } catch (error) {
      console.error('Error retrieving partial submission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Complete partial submission and convert to final submission
   * @param formId - Form identifier
   * @param sessionId - User session identifier
   * @param finalResponses - Complete response data
   * @returns Final submission result
   */
  static async completePartialSubmission(
    formId: string,
    sessionId: string,
    finalResponses: Record<string, any>,
    metadata: IPartialSubmissionMetadata = {}
  ): Promise<ICompletionResult> {
    try {
      const partialSubmission = await this.findPartialSubmission(formId, sessionId);

      if (!partialSubmission) {
        // If no partial submission exists, create a regular submission
        return await this.createDirectSubmission(formId, finalResponses, metadata);
      }

      // Merge partial data with final responses
      const mergedResponses = {
        ...partialSubmission.responses,
        ...finalResponses
      };

      // Create final form response
      const finalSubmission = new FormResponse({
        formId: new Types.ObjectId(formId),
        responses: mergedResponses,
        submittedAt: new Date(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          referrer: metadata.referrer,
          screenResolution: metadata.screenResolution,
          timezone: metadata.timezone,
          language: metadata.language,
          sessionId: sessionId,
          wasPartialSubmission: true,
          totalTimeSpent: (metadata.timeSpent || 0) + (partialSubmission.metadata.timeSpent || 0),
          saveCount: partialSubmission.metadata.saveCount || 0
        },
        isValid: true,
        validationErrors: []
      });

      await finalSubmission.save();

      // Update form analytics
      await this.updateFormAnalytics(formId, 'completion');

      // Clean up partial submission
      await this.deletePartialSubmission(formId, sessionId);

      // Track analytics
      await this.trackPartialSubmissionAnalytics(formId, 'complete');

      return {
        success: true,
        submissionId: finalSubmission._id.toString(),
        wasPartialSubmission: true,
        partialSubmissionData: {
          sessionId: partialSubmission.sessionId,
          createdAt: partialSubmission.createdAt,
          saveCount: partialSubmission.metadata.saveCount || 0,
          totalTimeSpent: partialSubmission.metadata.timeSpent || 0
        }
      };
    } catch (error) {
      console.error('Error completing partial submission:', error);
      return {
        success: false,
        wasPartialSubmission: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Delete partial submission
   * @param formId - Form identifier
   * @param sessionId - User session identifier
   * @returns Deletion result
   */
  static async deletePartialSubmission(
    formId: string,
    sessionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await PartialSubmission.deleteOne({
        formId: new Types.ObjectId(formId),
        sessionId
      });

      return {
        success: result.deletedCount > 0
      };
    } catch (error) {
      console.error('Error deleting partial submission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Clean up expired partial submissions
   * @param olderThanDays - Delete submissions older than specified days
   * @returns Cleanup result
   */
  static async cleanupExpiredSubmissions(olderThanDays: number = 30): Promise<{
    success: boolean;
    deletedCount: number;
    error?: string;
  }> {
    try {
      const result = await PartialSubmission.cleanupExpired(olderThanDays);

      return {
        success: true,
        deletedCount: result.deletedCount || 0
      };
    } catch (error) {
      console.error('Error cleaning up expired submissions:', error);
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get partial submission statistics
   * @param formId - Form identifier (optional)
   * @returns Statistics about partial submissions
   */
  static async getPartialSubmissionStats(formId?: string): Promise<IPartialSubmissionStats> {
    try {
      let stats;
      
      if (formId) {
        const result = await PartialSubmission.getFormStats(formId);
        stats = result[0];
      } else {
        const result = await PartialSubmission.aggregate([
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
        stats = result[0];
      }

      const result = stats || {
        totalPartialSubmissions: 0,
        averageProgress: 0,
        averageSaveCount: 0,
        averageTimeSpent: 0,
        totalFieldsSaved: 0
      };

      // Get completion rate if formId specified
      let completionRate = 0;
      if (formId) {
        const form = await Form.findById(formId);
        if (form) {
          const totalSubmissions = form.analytics.submissions || 0;
          completionRate = result.totalPartialSubmissions > 0 
            ? (totalSubmissions / (totalSubmissions + result.totalPartialSubmissions)) * 100 
            : 100;
        }
      }

      return {
        totalPartialSubmissions: result.totalPartialSubmissions,
        averageProgress: Math.round(result.averageProgress * 100) / 100,
        averageSaveCount: Math.round(result.averageSaveCount * 100) / 100,
        averageTimeSpent: Math.round(result.averageTimeSpent),
        totalFieldsSaved: result.totalFieldsSaved,
        completionRate: Math.round(completionRate * 100) / 100
      };
    } catch (error) {
      console.error('Error getting partial submission stats:', error);
      return {
        totalPartialSubmissions: 0,
        averageProgress: 0,
        averageSaveCount: 0,
        averageTimeSpent: 0,
        totalFieldsSaved: 0,
        completionRate: 0
      };
    }
  }

  // Helper methods
  private static async findPartialSubmission(formId: string, sessionId: string): Promise<any> {
    return await PartialSubmission.findByFormAndSession(formId, sessionId);
  }

  private static calculateProgress(responses: Record<string, any>, fields: IFormField[]): IProgressInfo {
    const totalFields = fields.filter(field => field.required).length;
    const answeredFields = Object.keys(responses).filter(fieldId => {
      const value = responses[fieldId];
      return value !== null && value !== undefined && value !== '';
    }).length;

    const percentage = totalFields > 0 ? (answeredFields / totalFields) * 100 : 0;

    return {
      totalFields,
      answeredFields,
      percentage: Math.round(percentage * 100) / 100,
      missingRequiredFields: totalFields - answeredFields
    };
  }

  private static calculateExpirationDate(daysToExpire: number): Date {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToExpire);
    return expirationDate;
  }

  private static async createDirectSubmission(
    formId: string,
    responses: Record<string, any>,
    metadata: IPartialSubmissionMetadata
  ): Promise<ICompletionResult> {
    const finalSubmission = new FormResponse({
      formId: new Types.ObjectId(formId),
      responses,
      submittedAt: new Date(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        referrer: metadata.referrer,
        screenResolution: metadata.screenResolution,
        timezone: metadata.timezone,
        language: metadata.language,
        wasPartialSubmission: false,
        totalTimeSpent: metadata.timeSpent || 0
      },
      isValid: true,
      validationErrors: []
    });

    await finalSubmission.save();
    await this.updateFormAnalytics(formId, 'completion');

    return {
      success: true,
      submissionId: finalSubmission._id.toString(),
      wasPartialSubmission: false
    };
  }

  private static async updateFormAnalytics(formId: string, action: 'save' | 'completion'): Promise<void> {
    const updateQuery = action === 'completion' 
      ? { $inc: { 'analytics.submissions': 1, 'analytics.completions': 1 } }
      : { $inc: { 'analytics.starts': 1 } };

    await Form.findByIdAndUpdate(formId, updateQuery);
  }

  private static async trackPartialSubmissionAnalytics(
    formId: string,
    action: 'save' | 'retrieve' | 'complete'
  ): Promise<void> {
    // This would integrate with your analytics service
    console.log(`Partial submission ${action} tracked for form ${formId}`);
  }
}

// Type definitions
export interface IPartialSubmission {
  _id?: Types.ObjectId;
  formId: Types.ObjectId;
  sessionId: string;
  responses: Record<string, any>;
  isComplete: boolean;
  progress: IProgressInfo;
  lastSavedAt: Date;
  expiresAt: Date;
  metadata: IPartialSubmissionMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPartialSubmissionMetadata {
  ipAddress?: string;
  userAgent?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  referrer?: string;
  saveCount?: number;
  fieldCount?: number;
  timeSpent?: number;
}

export interface IProgressInfo {
  totalFields: number;
  answeredFields: number;
  percentage: number;
  missingRequiredFields: number;
}

export interface IPartialSubmissionResult {
  success: boolean;
  submissionId?: string;
  sessionId?: string;
  responses?: Record<string, any>;
  progress?: IProgressInfo;
  lastSavedAt?: Date;
  expiresAt?: Date;
  metadata?: IPartialSubmissionMetadata;
  createdAt?: Date;
  error?: string;
}

export interface ICompletionResult {
  success: boolean;
  submissionId?: string;
  wasPartialSubmission: boolean;
  partialSubmissionData?: {
    sessionId: string;
    createdAt: Date;
    saveCount: number;
    totalTimeSpent: number;
  };
  error?: string;
}

export interface IPartialSubmissionStats {
  totalPartialSubmissions: number;
  averageProgress: number;
  averageSaveCount: number;
  averageTimeSpent: number;
  totalFieldsSaved: number;
  completionRate: number;
}

export default PartialSubmissionService;