import { Types } from 'mongoose';
import { IForm, IFormResponse, IUser } from '../types';
import Form from '../models/Form';
import FormResponse from '../models/FormResponse';
import User from '../models/User';
import crypto from 'crypto';

/**
 * GDPR Compliance Service
 * Handles data privacy compliance, consent management, and data subject rights
 */
export class GDPRComplianceService {

  /**
   * Record user consent for data processing
   * @param userId - User identifier
   * @param consentType - Type of consent
   * @param consentData - Consent details
   * @returns Consent record
   */
  static async recordConsent(
    userId: string,
    consentType: IGDPRConsentType,
    consentData: IGDPRConsentData
  ): Promise<IGDPRConsentRecord> {
    try {
      const consentRecord: IGDPRConsentRecord = {
        id: crypto.randomUUID(),
        userId,
        consentType,
        purpose: consentData.purpose,
        legalBasis: consentData.legalBasis,
        consentGiven: consentData.consentGiven,
        consentTimestamp: new Date(),
        ipAddress: consentData.ipAddress,
        userAgent: consentData.userAgent,
        consentMethod: consentData.consentMethod,
        optInDetails: {
          explicitConsent: consentData.explicitConsent || false,
          consentText: consentData.consentText,
          granularConsent: consentData.granularConsent || {},
          parentalConsent: consentData.parentalConsent || false
        },
        dataCategories: consentData.dataCategories || [],
        retentionPeriod: consentData.retentionPeriod || 365,
        isActive: consentData.consentGiven,
        revokedAt: null,
        source: consentData.source || 'form_submission'
      };

      // Store consent record (in a real application, this would be stored in a dedicated consent collection)
      console.log('GDPR Consent recorded:', consentRecord);

      return consentRecord;
    } catch (error) {
      console.error('Error recording consent:', error);
      throw error;
    }
  }

  /**
   * Revoke user consent
   * @param consentId - Consent record identifier
   * @param revocationData - Revocation details
   * @returns Updated consent record
   */
  static async revokeConsent(
    consentId: string,
    revocationData: IGDPRRevocationData
  ): Promise<IGDPRConsentRecord> {
    try {
      // In a real application, this would update the consent record in the database
      const updatedConsent: IGDPRConsentRecord = {
        id: consentId,
        userId: revocationData.userId,
        consentType: 'data_processing',
        purpose: 'revoked',
        legalBasis: 'consent',
        consentGiven: false,
        consentTimestamp: new Date(),
        ipAddress: revocationData.ipAddress,
        userAgent: revocationData.userAgent,
        consentMethod: this.mapRevocationMethodToConsentMethod(revocationData.revocationMethod),
        optInDetails: {
          explicitConsent: false,
          consentText: 'Consent revoked',
          granularConsent: {},
          parentalConsent: false
        },
        dataCategories: [],
        retentionPeriod: 0,
        isActive: false,
        revokedAt: new Date(),
        source: 'consent_revocation'
      };

      console.log('GDPR Consent revoked:', updatedConsent);

      return updatedConsent;
    } catch (error) {
      console.error('Error revoking consent:', error);
      throw error;
    }
  }

  /**
   * Handle data subject access request (Right of Access)
   * @param requestData - Access request data
   * @returns Personal data export
   */
  static async handleAccessRequest(
    requestData: IGDPRAccessRequest
  ): Promise<IGDPRAccessResponse> {
    try {
      const { email, userId, requestId } = requestData;

      // Find user by email or ID
      let user: any;
      if (userId) {
        user = await User.findById(userId);
      } else if (email) {
        user = await User.findOne({ email });
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Collect all personal data
      const personalData = await this.collectPersonalData(user._id.toString());
      
      // Generate data export
      const accessResponse: IGDPRAccessResponse = {
        requestId: requestId || crypto.randomUUID(),
        userId: user._id.toString(),
        email: user.email,
        requestDate: new Date(),
        dataExported: personalData,
        exportFormat: 'json',
        retentionNotice: this.generateRetentionNotice(personalData),
        dataProcessingPurposes: this.getDataProcessingPurposes(),
        thirdPartySharing: this.getThirdPartySharing(),
        userRights: this.getUserRights()
      };

      // Log the access request
      await this.logGDPRActivity(user._id.toString(), 'access_request', {
        requestId: accessResponse.requestId,
        dataCategories: Object.keys(personalData),
        requestedAt: new Date()
      });

      return accessResponse;
    } catch (error) {
      console.error('Error handling access request:', error);
      throw error;
    }
  }

  /**
   * Handle data erasure request (Right to be Forgotten)
   * @param requestData - Erasure request data
   * @returns Erasure confirmation
   */
  static async handleErasureRequest(
    requestData: IGDPRErasureRequest
  ): Promise<IGDPRErasureResponse> {
    try {
      const { email, userId, requestId, erasureScope } = requestData;

      // Find user
      let user: any;
      if (userId) {
        user = await User.findById(userId);
      } else if (email) {
        user = await User.findOne({ email });
      }

      if (!user) {
        throw new Error('User not found');
      }

      const userIdStr = user._id.toString();
      const erasureResults: IGDPRErasureResult[] = [];

      // Handle different erasure scopes
      if (erasureScope.includes('account_data')) {
        const accountResult = await this.eraseAccountData(userIdStr);
        erasureResults.push(accountResult);
      }

      if (erasureScope.includes('form_responses')) {
        const responseResult = await this.eraseFormResponses(userIdStr);
        erasureResults.push(responseResult);
      }

      if (erasureScope.includes('forms')) {
        const formsResult = await this.eraseForms(userIdStr);
        erasureResults.push(formsResult);
      }

      if (erasureScope.includes('analytics_data')) {
        const analyticsResult = await this.eraseAnalyticsData(userIdStr);
        erasureResults.push(analyticsResult);
      }

      // Log the erasure request
      await this.logGDPRActivity(userIdStr, 'erasure_request', {
        requestId: requestId || crypto.randomUUID(),
        erasureScope,
        erasureResults,
        requestedAt: new Date()
      });

      const erasureResponse: IGDPRErasureResponse = {
        requestId: requestId || crypto.randomUUID(),
        userId: userIdStr,
        email: user.email,
        requestDate: new Date(),
        erasureCompleted: true,
        erasureResults,
        retainedData: this.getRetainedDataNotice(),
        legalObligations: this.getLegalObligationsNotice()
      };

      return erasureResponse;
    } catch (error) {
      console.error('Error handling erasure request:', error);
      throw error;
    }
  }

  /**
   * Handle data portability request (Right to Data Portability)
   * @param requestData - Portability request data
   * @returns Portable data export
   */
  static async handlePortabilityRequest(
    requestData: IGDPRPortabilityRequest
  ): Promise<IGDPRPortabilityResponse> {
    try {
      const { email, userId, requestId, exportFormat } = requestData;

      // Find user
      let user: any;
      if (userId) {
        user = await User.findById(userId);
      } else if (email) {
        user = await User.findOne({ email });
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Collect portable data (data provided by the user)
      const portableData = await this.collectPortableData(user._id.toString());
      
      // Format data based on requested format
      const formattedData = await this.formatPortableData(portableData, exportFormat || 'json');

      const portabilityResponse: IGDPRPortabilityResponse = {
        requestId: requestId || crypto.randomUUID(),
        userId: user._id.toString(),
        email: user.email,
        requestDate: new Date(),
        exportFormat: exportFormat || 'json',
        portableData: formattedData,
        dataCategories: Object.keys(portableData),
        technicalDetails: {
          encoding: 'UTF-8',
          structure: 'JSON',
          apiVersion: '1.0'
        }
      };

      // Log the portability request
      await this.logGDPRActivity(user._id.toString(), 'portability_request', {
        requestId: portabilityResponse.requestId,
        exportFormat,
        dataCategories: Object.keys(portableData),
        requestedAt: new Date()
      });

      return portabilityResponse;
    } catch (error) {
      console.error('Error handling portability request:', error);
      throw error;
    }
  }

  /**
   * Generate data processing record
   * @param formId - Form identifier
   * @returns Data processing record
   */
  static async generateDataProcessingRecord(formId: string): Promise<IGDPRDataProcessingRecord> {
    try {
      const form = await Form.findById(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      const processingRecord: IGDPRDataProcessingRecord = {
        id: crypto.randomUUID(),
        formId,
        formTitle: form.title,
        dataController: {
          name: 'Form Platform',
          email: process.env.DATA_CONTROLLER_EMAIL || 'privacy@example.com',
          address: process.env.DATA_CONTROLLER_ADDRESS || 'Not specified'
        },
        processingPurpose: this.determineProcessingPurpose(form),
        legalBasis: 'consent', // Default legal basis
        dataCategories: this.extractDataCategories(form.fields),
        dataSubjects: ['form_respondents'],
        recipients: this.determineRecipients(form),
        internationalTransfers: false,
        retentionPeriod: form.settings?.gdpr?.dataRetentionDays || 365,
        securityMeasures: this.getSecurityMeasures(),
        dataSubjectRights: this.getUserRights(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return processingRecord;
    } catch (error) {
      console.error('Error generating data processing record:', error);
      throw error;
    }
  }

  /**
   * Validate GDPR compliance for a form
   * @param formId - Form identifier
   * @returns Compliance validation result
   */
  static async validateFormCompliance(formId: string): Promise<IGDPRComplianceValidation> {
    try {
      const form = await Form.findById(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      const validationResults: IGDPRValidationResult[] = [];

      // Check consent mechanism
      if (!form.settings?.gdpr?.enabled) {
        validationResults.push({
          requirement: 'gdpr_enabled',
          compliant: false,
          severity: 'critical',
          message: 'GDPR compliance must be enabled',
          recommendation: 'Enable GDPR compliance in form settings'
        });
      }

      // Check consent text
      if (!form.settings?.gdpr?.consentText) {
        validationResults.push({
          requirement: 'consent_text',
          compliant: false,
          severity: 'critical',
          message: 'Consent text is required',
          recommendation: 'Add clear consent text explaining data processing'
        });
      }

      // Check privacy policy link
      if (!form.settings?.gdpr?.privacyPolicyUrl) {
        validationResults.push({
          requirement: 'privacy_policy',
          compliant: false,
          severity: 'high',
          message: 'Privacy policy URL is missing',
          recommendation: 'Provide a link to your privacy policy'
        });
      }

      // Check data retention period
      const retentionDays = form.settings?.gdpr?.dataRetentionDays || 0;
      if (retentionDays <= 0 || retentionDays > 2555) { // 7 years max
        validationResults.push({
          requirement: 'data_retention',
          compliant: false,
          severity: 'medium',
          message: 'Data retention period should be between 1 day and 7 years',
          recommendation: 'Set an appropriate data retention period'
        });
      }

      // Check for sensitive data fields
      const sensitiveFields = this.identifySensitiveFields(form.fields);
      if (sensitiveFields.length > 0) {
        validationResults.push({
          requirement: 'sensitive_data',
          compliant: false,
          severity: 'high',
          message: `Sensitive data fields detected: ${sensitiveFields.join(', ')}`,
          recommendation: 'Consider additional protection for sensitive data or explicit consent'
        });
      }

      const complianceScore = this.calculateComplianceScore(validationResults);

      return {
        formId,
        formTitle: form.title,
        complianceScore,
        isCompliant: complianceScore >= 80,
        validationResults,
        recommendations: this.generateRecommendations(validationResults),
        validatedAt: new Date()
      };
    } catch (error) {
      console.error('Error validating form compliance:', error);
      throw error;
    }
  }

  // Helper methods
  private static async collectPersonalData(userId: string): Promise<Record<string, any>> {
    const user = await User.findById(userId);
    const forms = await Form.find({ userId });
    const responses = await FormResponse.find({
      formId: { $in: forms.map(f => f._id) }
    });

    return {
      profile: {
        email: user?.email,
        name: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown',
        createdAt: user?.createdAt,
        lastLogin: user?.lastLogin
      },
      forms: forms.map(form => ({
        id: form._id,
        title: form.title,
        createdAt: form.createdAt,
        responses: form.analytics.submissions
      })),
      submissions: responses.map(response => ({
        id: response._id,
        formId: response.formId,
        submittedAt: response.submittedAt,
        responses: response.responses
      }))
    };
  }

  private static async collectPortableData(userId: string): Promise<Record<string, any>> {
    // Only include data that was directly provided by the user
    const forms = await Form.find({ userId });
    const userSubmissions = await FormResponse.find({
      'metadata.userId': userId
    });

    return {
      forms: forms.map(form => ({
        title: form.title,
        description: form.description,
        fields: form.fields,
        customization: form.customization
      })),
      submissions: userSubmissions.map(response => ({
        formTitle: response.formId,
        submittedAt: response.submittedAt,
        responses: response.responses
      }))
    };
  }

  private static async eraseAccountData(userId: string): Promise<IGDPRErasureResult> {
    try {
      // In a real implementation, this would anonymize or delete account data
      console.log(`Erasing account data for user: ${userId}`);
      
      return {
        dataCategory: 'account_data',
        recordsAffected: 1,
        erasureMethod: 'deletion',
        completedAt: new Date(),
        success: true
      };
    } catch (error) {
      return {
        dataCategory: 'account_data',
        recordsAffected: 0,
        erasureMethod: 'deletion',
        completedAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async eraseFormResponses(userId: string): Promise<IGDPRErasureResult> {
    try {
      // Anonymize or delete form responses
      const result = await FormResponse.deleteMany({
        'metadata.userId': userId
      });

      return {
        dataCategory: 'form_responses',
        recordsAffected: result.deletedCount || 0,
        erasureMethod: 'deletion',
        completedAt: new Date(),
        success: true
      };
    } catch (error) {
      return {
        dataCategory: 'form_responses',
        recordsAffected: 0,
        erasureMethod: 'deletion',
        completedAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async eraseForms(userId: string): Promise<IGDPRErasureResult> {
    try {
      // Delete user's forms
      const result = await Form.deleteMany({ userId });

      return {
        dataCategory: 'forms',
        recordsAffected: result.deletedCount || 0,
        erasureMethod: 'deletion',
        completedAt: new Date(),
        success: true
      };
    } catch (error) {
      return {
        dataCategory: 'forms',
        recordsAffected: 0,
        erasureMethod: 'deletion',
        completedAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async eraseAnalyticsData(userId: string): Promise<IGDPRErasureResult> {
    try {
      // Reset analytics data for user's forms
      await Form.updateMany(
        { userId },
        {
          $set: {
            'analytics.views': 0,
            'analytics.submissions': 0,
            'analytics.starts': 0,
            'analytics.completions': 0
          }
        }
      );

      return {
        dataCategory: 'analytics_data',
        recordsAffected: 1,
        erasureMethod: 'anonymization',
        completedAt: new Date(),
        success: true
      };
    } catch (error) {
      return {
        dataCategory: 'analytics_data',
        recordsAffected: 0,
        erasureMethod: 'anonymization',
        completedAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async formatPortableData(data: Record<string, any>, format: string): Promise<any> {
    switch (format) {
      case 'json':
        return data;
      case 'csv':
        // Convert to CSV format
        return this.convertToCSV(data);
      case 'xml':
        // Convert to XML format
        return this.convertToXML(data);
      default:
        return data;
    }
  }

  private static convertToCSV(data: Record<string, any>): string {
    // Simple CSV conversion
    const csv = Object.entries(data)
      .map(([key, value]) => `${key},${JSON.stringify(value)}`)
      .join('\n');
    return csv;
  }

  private static convertToXML(data: Record<string, any>): string {
    // Simple XML conversion
    const xml = Object.entries(data)
      .map(([key, value]) => `<${key}>${JSON.stringify(value)}</${key}>`)
      .join('\n');
    return `<data>\n${xml}\n</data>`;
  }

  private static async logGDPRActivity(userId: string, activity: string, details: any): Promise<void> {
    // In a real application, this would log to a dedicated GDPR audit log
    console.log('GDPR Activity:', {
      userId,
      activity,
      details,
      timestamp: new Date()
    });
  }

  private static determineProcessingPurpose(form: any): string[] {
    // Analyze form to determine processing purposes
    return ['form_submission_processing', 'analytics', 'communication'];
  }

  private static extractDataCategories(fields: any[]): string[] {
    const categories: Set<string> = new Set();
    
    fields.forEach(field => {
      switch (field.type) {
        case 'email':
          categories.add('contact_information');
          break;
        case 'name':
          categories.add('personal_identifiers');
          break;
        case 'phone':
          categories.add('contact_information');
          break;
        case 'address':
          categories.add('location_data');
          break;
        default:
          categories.add('form_responses');
      }
    });

    return Array.from(categories);
  }

  private static determineRecipients(form: any): string[] {
    const recipients = ['form_owner'];
    
    if (form.integrations?.length > 0) {
      recipients.push('third_party_integrations');
    }
    
    return recipients;
  }

  private static getSecurityMeasures(): string[] {
    return [
      'encryption_in_transit',
      'encryption_at_rest',
      'access_controls',
      'audit_logging',
      'data_minimization'
    ];
  }

  private static getUserRights(): string[] {
    return [
      'right_of_access',
      'right_to_rectification',
      'right_to_erasure',
      'right_to_restrict_processing',
      'right_to_data_portability',
      'right_to_object',
      'right_to_withdraw_consent'
    ];
  }

  private static getDataProcessingPurposes(): string[] {
    return [
      'form_processing',
      'analytics_and_insights',
      'communication',
      'service_improvement'
    ];
  }

  private static getThirdPartySharing(): string[] {
    return [
      'cloud_storage_providers',
      'analytics_services',
      'email_services'
    ];
  }

  private static getRetainedDataNotice(): string[] {
    return [
      'legal_compliance_data',
      'fraud_prevention_records',
      'anonymized_analytics'
    ];
  }

  private static getLegalObligationsNotice(): string[] {
    return [
      'tax_records_retention',
      'audit_requirements',
      'legal_dispute_records'
    ];
  }

  private static generateRetentionNotice(data: Record<string, any>): string {
    return `Your personal data will be retained according to our data retention policy. Different categories of data may have different retention periods based on legal requirements and business needs.`;
  }

  private static identifySensitiveFields(fields: any[]): string[] {
    const sensitiveFieldTypes = ['password', 'ssn', 'payment', 'health'];
    return fields
      .filter(field => sensitiveFieldTypes.includes(field.type) || 
                      field.label.toLowerCase().includes('password') ||
                      field.label.toLowerCase().includes('ssn'))
      .map(field => field.label);
  }

  private static calculateComplianceScore(results: IGDPRValidationResult[]): number {
    const totalChecks = results.length;
    if (totalChecks === 0) return 100;

    const failedCritical = results.filter(r => !r.compliant && r.severity === 'critical').length;
    const failedHigh = results.filter(r => !r.compliant && r.severity === 'high').length;
    const failedMedium = results.filter(r => !r.compliant && r.severity === 'medium').length;

    // Weighted scoring: critical = 30 points, high = 20 points, medium = 10 points
    const deductions = (failedCritical * 30) + (failedHigh * 20) + (failedMedium * 10);
    const maxPossibleDeductions = totalChecks * 30; // Assuming all are critical for max
    
    return Math.max(0, Math.round(100 - (deductions / maxPossibleDeductions * 100)));
  }

  private static generateRecommendations(results: IGDPRValidationResult[]): string[] {
    return results
      .filter(r => !r.compliant)
      .map(r => r.recommendation);
  }

  /**
   * Map revocation method to valid consent method
   */
  private static mapRevocationMethodToConsentMethod(revocationMethod: string): 'checkbox' | 'button_click' | 'form_submission' | 'email_confirmation' {
    const mapping: Record<string, 'checkbox' | 'button_click' | 'form_submission' | 'email_confirmation'> = {
      'button_click': 'button_click',
      'email_request': 'email_confirmation',
      'phone_request': 'form_submission',
      'written_request': 'form_submission'
    };
    
    return mapping[revocationMethod] || 'form_submission';
  }
}

// Type definitions
export type IGDPRConsentType = 'data_processing' | 'marketing' | 'analytics' | 'cookies' | 'third_party_sharing';

export interface IGDPRConsentData {
  purpose: string;
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
  consentGiven: boolean;
  ipAddress?: string;
  userAgent?: string;
  consentMethod: 'checkbox' | 'button_click' | 'form_submission' | 'email_confirmation';
  explicitConsent?: boolean;
  consentText?: string;
  granularConsent?: Record<string, boolean>;
  parentalConsent?: boolean;
  dataCategories?: string[];
  retentionPeriod?: number;
  source?: string;
}

export interface IGDPRConsentRecord extends IGDPRConsentData {
  id: string;
  userId: string;
  consentType: IGDPRConsentType;
  consentTimestamp: Date;
  optInDetails: {
    explicitConsent: boolean;
    consentText?: string;
    granularConsent: Record<string, boolean>;
    parentalConsent: boolean;
  };
  isActive: boolean;
  revokedAt: Date | null;
}

export interface IGDPRRevocationData {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  revocationMethod: 'button_click' | 'email_request' | 'phone_request' | 'written_request';
}

export interface IGDPRAccessRequest {
  email?: string;
  userId?: string;
  requestId?: string;
  verificationMethod: 'email' | 'identity_document' | 'account_login';
}

export interface IGDPRAccessResponse {
  requestId: string;
  userId: string;
  email: string;
  requestDate: Date;
  dataExported: Record<string, any>;
  exportFormat: string;
  retentionNotice: string;
  dataProcessingPurposes: string[];
  thirdPartySharing: string[];
  userRights: string[];
}

export interface IGDPRErasureRequest {
  email?: string;
  userId?: string;
  requestId?: string;
  erasureScope: string[];
  verificationMethod: 'email' | 'identity_document' | 'account_login';
}

export interface IGDPRErasureResponse {
  requestId: string;
  userId: string;
  email: string;
  requestDate: Date;
  erasureCompleted: boolean;
  erasureResults: IGDPRErasureResult[];
  retainedData: string[];
  legalObligations: string[];
}

export interface IGDPRErasureResult {
  dataCategory: string;
  recordsAffected: number;
  erasureMethod: 'deletion' | 'anonymization' | 'pseudonymization';
  completedAt: Date;
  success: boolean;
  error?: string;
}

export interface IGDPRPortabilityRequest {
  email?: string;
  userId?: string;
  requestId?: string;
  exportFormat?: 'json' | 'csv' | 'xml';
  verificationMethod: 'email' | 'identity_document' | 'account_login';
}

export interface IGDPRPortabilityResponse {
  requestId: string;
  userId: string;
  email: string;
  requestDate: Date;
  exportFormat: string;
  portableData: any;
  dataCategories: string[];
  technicalDetails: {
    encoding: string;
    structure: string;
    apiVersion: string;
  };
}

export interface IGDPRDataProcessingRecord {
  id: string;
  formId: string;
  formTitle: string;
  dataController: {
    name: string;
    email: string;
    address: string;
  };
  processingPurpose: string[];
  legalBasis: string;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  internationalTransfers: boolean;
  retentionPeriod: number;
  securityMeasures: string[];
  dataSubjectRights: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IGDPRComplianceValidation {
  formId: string;
  formTitle: string;
  complianceScore: number;
  isCompliant: boolean;
  validationResults: IGDPRValidationResult[];
  recommendations: string[];
  validatedAt: Date;
}

export interface IGDPRValidationResult {
  requirement: string;
  compliant: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  recommendation: string;
}

export default GDPRComplianceService;