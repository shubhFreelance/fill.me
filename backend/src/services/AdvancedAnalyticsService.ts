import { Types } from 'mongoose';
import { IForm, IFormResponse } from '../types';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';
import User from '../models/User';

/**
 * Advanced Analytics Service
 * Handles comprehensive metrics tracking and analytics
 */
export class AdvancedAnalyticsService {

  /**
   * Track form view event
   */
  static async trackFormView(formId: string, sessionData: ISessionData): Promise<void> {
    try {
      const form = await Form.findById(formId);
      if (!form) return;

      form.analytics.views += 1;
      form.analytics.deviceStats = this.updateDeviceStats(form.analytics.deviceStats, sessionData.device);
      
      if (sessionData.referrer) {
        this.updateReferrerStats(form.analytics.referrerStats, sessionData.referrer);
      }

      await form.save();
      await this.recordEvent('form_view', formId, sessionData);
    } catch (error) {
      console.error('Error tracking form view:', error);
    }
  }

  /**
   * Track form submission
   */
  static async trackFormSubmission(
    formId: string, 
    responseId: string, 
    sessionData: ISessionData,
    submissionData: ISubmissionData
  ): Promise<void> {
    try {
      const form = await Form.findById(formId);
      if (!form) return;

      form.analytics.submissions += 1;
      form.analytics.completions += 1;
      
      if (submissionData.completionTime) {
        const currentAvg = form.analytics.averageCompletionTime || 0;
        const totalCompletions = form.analytics.completions;
        form.analytics.averageCompletionTime = 
          (currentAvg * (totalCompletions - 1) + submissionData.completionTime) / totalCompletions;
      }

      await form.save();
      await this.recordEvent('form_submission', formId, sessionData, { responseId, submissionData });
    } catch (error) {
      console.error('Error tracking form submission:', error);
    }
  }

  /**
   * Get comprehensive form analytics
   */
  static async getFormAnalytics(formId: string, dateRange?: IDateRange): Promise<IFormAnalytics> {
    try {
      const form = await Form.findById(formId);
      if (!form) throw new Error('Form not found');

      const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = dateRange?.end || new Date();

      // Get responses in date range
      const responses = await FormResponse.find({
        formId: new Types.ObjectId(formId),
        submittedAt: { $gte: startDate, $lte: endDate }
      });

      // Calculate metrics
      const conversionRate = form.analytics.views > 0 ? (form.analytics.submissions / form.analytics.views) * 100 : 0;
      const completionRate = form.analytics.starts > 0 ? (form.analytics.completions / form.analytics.starts) * 100 : 0;

      // Time-based analytics
      const timeAnalytics = this.calculateTimeAnalytics(responses);
      const deviceAnalytics = this.calculateDeviceAnalytics(form.analytics.deviceStats);
      const insights = this.generateInsights(form.analytics, conversionRate, completionRate);

      return {
        basic: {
          views: form.analytics.views,
          submissions: form.analytics.submissions,
          completions: form.analytics.completions,
          conversionRate,
          completionRate,
          averageCompletionTime: form.analytics.averageCompletionTime || 0
        },
        timeAnalytics,
        deviceAnalytics,
        insights,
        responseCount: responses.length,
        dateRange: { start: startDate, end: endDate }
      };
    } catch (error) {
      console.error('Error getting form analytics:', error);
      throw error;
    }
  }

  /**
   * Get user analytics across all forms
   */
  static async getUserAnalytics(userId: string, dateRange?: IDateRange): Promise<IUserAnalytics> {
    try {
      const forms = await Form.find({ userId: new Types.ObjectId(userId) });
      
      const totalViews = forms.reduce((sum, form) => sum + form.analytics.views, 0);
      const totalSubmissions = forms.reduce((sum, form) => sum + form.analytics.submissions, 0);
      
      const topForms = forms
        .sort((a, b) => b.analytics.submissions - a.analytics.submissions)
        .slice(0, 5)
        .map(form => ({
          formId: form._id.toString(),
          title: form.title,
          submissions: form.analytics.submissions,
          conversionRate: form.analytics.views > 0 ? (form.analytics.submissions / form.analytics.views) * 100 : 0
        }));

      return {
        summary: {
          totalForms: forms.length,
          activeForms: forms.filter(form => form.isActive).length,
          totalViews,
          totalSubmissions,
          averageConversionRate: totalViews > 0 ? (totalSubmissions / totalViews) * 100 : 0
        },
        topPerformingForms: topForms,
        dateRange: dateRange || { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() }
      };
    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }

  /**
   * Generate real-time dashboard data
   */
  static async getRealTimeDashboard(userId: string): Promise<IRealTimeDashboard> {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Get recent responses
      const recentResponses = await FormResponse.find({
        submittedAt: { $gte: last24Hours }
      }).populate('formId', 'title userId').limit(50);

      const userResponses = recentResponses.filter((response: any) => 
        response.formId?.userId?.toString() === userId
      );

      const hourlyData = this.groupResponsesByHour(userResponses);

      return {
        recentSubmissions: userResponses.length,
        hourlyData,
        liveActivity: userResponses.slice(0, 10).map((response: any) => ({
          formTitle: response.formId?.title || 'Unknown Form',
          submittedAt: response.submittedAt,
          responseId: response._id.toString()
        })),
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting real-time dashboard:', error);
      throw error;
    }
  }

  // Helper methods
  private static updateDeviceStats(deviceStats: any, device: string): any {
    const stats = deviceStats || { mobile: 0, tablet: 0, desktop: 0 };
    stats[device.toLowerCase()] = (stats[device.toLowerCase()] || 0) + 1;
    return stats;
  }

  private static updateReferrerStats(referrerStats: Map<string, number>, referrer: string): void {
    const domain = this.extractDomain(referrer);
    const current = referrerStats.get(domain) || 0;
    referrerStats.set(domain, current + 1);
  }

  private static extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'direct';
    }
  }

  private static async recordEvent(type: string, formId: string, sessionData: ISessionData, metadata?: any): Promise<void> {
    // Placeholder for event recording - would integrate with analytics service
    console.log(`Analytics: ${type} for form ${formId}`);
  }

  private static calculateTimeAnalytics(responses: any[]): ITimeAnalytics {
    const hourlyData = this.groupResponsesByHour(responses);
    const dailyData = this.groupResponsesByDay(responses);

    return {
      hourlyDistribution: hourlyData,
      dailyTrend: dailyData,
      peakHour: this.findPeakHour(hourlyData),
      totalInPeriod: responses.length
    };
  }

  private static calculateDeviceAnalytics(deviceStats: any): IDeviceAnalytics {
    const total = Object.values(deviceStats || {}).reduce((sum: number, count: any) => sum + count, 0);
    
    return {
      distribution: deviceStats || {},
      totalEvents: total,
      mobilePercentage: total > 0 ? ((deviceStats?.mobile || 0) / total) * 100 : 0
    };
  }

  private static generateInsights(analytics: any, conversionRate: number, completionRate: number): IAnalyticsInsight[] {
    const insights: IAnalyticsInsight[] = [];

    if (conversionRate < 5) {
      insights.push({
        type: 'warning',
        title: 'Low Conversion Rate',
        description: `Only ${conversionRate.toFixed(1)}% of visitors complete the form`,
        recommendation: 'Consider reducing form length or improving user experience'
      });
    }

    if (completionRate > 80) {
      insights.push({
        type: 'success',
        title: 'High Completion Rate',
        description: `${completionRate.toFixed(1)}% of users complete the form once started`,
        recommendation: 'Excellent! This form design works well'
      });
    }

    if (analytics.views > 1000 && analytics.submissions < 50) {
      insights.push({
        type: 'warning',
        title: 'High Traffic, Low Conversions',
        description: 'Many people view but few submit',
        recommendation: 'Review form complexity and required fields'
      });
    }

    return insights;
  }

  private static groupResponsesByHour(responses: any[]): Record<number, number> {
    return responses.reduce((acc, response) => {
      const hour = new Date(response.submittedAt).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
  }

  private static groupResponsesByDay(responses: any[]): Record<string, number> {
    return responses.reduce((acc, response) => {
      const day = new Date(response.submittedAt).toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private static findPeakHour(hourlyData: Record<number, number>): number {
    return Object.entries(hourlyData).reduce((peak, [hour, count]) => 
      count > (hourlyData[peak] || 0) ? parseInt(hour) : peak, 0
    );
  }
}

// Essential interfaces
export interface ISessionData {
  sessionId: string;
  userAgent: string;
  ipAddress?: string;
  referrer?: string;
  device: string;
  location?: { country?: string; city?: string; };
}

export interface ISubmissionData {
  completionTime?: number;
  fieldCount: number;
  validationErrors?: number;
}

export interface IDateRange {
  start: Date;
  end: Date;
}

export interface IFormAnalytics {
  basic: {
    views: number;
    submissions: number;
    completions: number;
    conversionRate: number;
    completionRate: number;
    averageCompletionTime: number;
  };
  timeAnalytics: ITimeAnalytics;
  deviceAnalytics: IDeviceAnalytics;
  insights: IAnalyticsInsight[];
  responseCount: number;
  dateRange: IDateRange;
}

export interface IUserAnalytics {
  summary: {
    totalForms: number;
    activeForms: number;
    totalViews: number;
    totalSubmissions: number;
    averageConversionRate: number;
  };
  topPerformingForms: Array<{
    formId: string;
    title: string;
    submissions: number;
    conversionRate: number;
  }>;
  dateRange: IDateRange;
}

export interface IRealTimeDashboard {
  recentSubmissions: number;
  hourlyData: Record<number, number>;
  liveActivity: Array<{
    formTitle: string;
    submittedAt: Date;
    responseId: string;
  }>;
  lastUpdated: Date;
}

export interface ITimeAnalytics {
  hourlyDistribution: Record<number, number>;
  dailyTrend: Record<string, number>;
  peakHour: number;
  totalInPeriod: number;
}

export interface IDeviceAnalytics {
  distribution: Record<string, number>;
  totalEvents: number;
  mobilePercentage: number;
}

export interface IAnalyticsInsight {
  type: 'success' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation: string;
}

export default AdvancedAnalyticsService;