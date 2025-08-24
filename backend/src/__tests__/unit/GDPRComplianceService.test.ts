import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../../models/User';
import Form from '../../models/Form';
import FormResponse from '../../models/FormResponse';
import { GDPRComplianceService } from '../../services/GDPRComplianceService';
import { TestUtils } from '../setup';

// Mock crypto.randomUUID for consistent testing
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid-12345')
}));

describe('GDPRComplianceService', () => {
  let testUser: any;
  let testForm: any;
  let testResponse: any;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Form.deleteMany({});
    await FormResponse.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    testUser = await User.create(userData);

    // Create test form
    const formData = TestUtils.createTestForm(testUser._id.toString());
    testForm = await Form.create(formData);

    // Create test response
    testResponse = await FormResponse.create({
      formId: testForm._id,
      responses: [
        {
          fieldId: 'field1',
          value: 'Test Response Value',
          fieldType: 'text'
        }
      ],
      submittedAt: new Date(),
      ipAddress: '192.168.1.1',
      userAgent: 'Test User Agent',
      metadata: {
        userId: testUser._id.toString(),
        submissionTime: 1500,
        deviceInfo: {
          type: 'desktop',
          browser: 'Chrome',
          os: 'Windows'
        }
      },
      isPartial: false,
      completedAt: new Date()
    });

    // Reset the mock
    (crypto.randomUUID as jest.Mock).mockClear();
  });

  afterEach(async () => {
    // Clean up after each test
    await User.deleteMany({});
    await Form.deleteMany({});
    await FormResponse.deleteMany({});
  });

  describe('recordConsent', () => {
    it('should record user consent successfully', async () => {
      const consentData = {
        purpose: 'form_submission',
        legalBasis: 'consent' as const,
        consentGiven: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        consentMethod: 'checkbox' as const,
        explicitConsent: true,
        consentText: 'I agree to the processing of my personal data',
        granularConsent: {
          marketing: false,
          analytics: true,
          necessary: true
        },
        parentalConsent: false,
        dataCategories: ['personal_identifiers', 'contact_information'],
        retentionPeriod: 365,
        source: 'form_submission'
      };

      const result = await GDPRComplianceService.recordConsent(
        testUser._id.toString(),
        'data_processing',
        consentData
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('test-uuid-12345');
      expect(result.userId).toBe(testUser._id.toString());
      expect(result.consentType).toBe('data_processing');
      expect(result.consentGiven).toBe(true);
      expect(result.isActive).toBe(true);
      expect(result.revokedAt).toBeNull();
      expect(result.optInDetails.explicitConsent).toBe(true);
      expect(result.optInDetails.granularConsent).toEqual(consentData.granularConsent);
      expect(result.dataCategories).toEqual(consentData.dataCategories);
      expect(result.retentionPeriod).toBe(365);
      expect(result.consentTimestamp).toBeInstanceOf(Date);
    });

    it('should record consent with default values', async () => {
      const minimalConsentData = {
        purpose: 'form_processing',
        legalBasis: 'consent' as const,
        consentGiven: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        consentMethod: 'button_click' as const
      };

      const result = await GDPRComplianceService.recordConsent(
        testUser._id.toString(),
        'marketing',
        minimalConsentData
      );

      expect(result.optInDetails.explicitConsent).toBe(false);
      expect(result.optInDetails.granularConsent).toEqual({});
      expect(result.optInDetails.parentalConsent).toBe(false);
      expect(result.dataCategories).toEqual([]);
      expect(result.retentionPeriod).toBe(365);
      expect(result.source).toBe('form_submission');
    });

    it('should record consent refusal', async () => {
      const refusalData = {
        purpose: 'marketing',
        legalBasis: 'consent' as const,
        consentGiven: false,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        consentMethod: 'checkbox' as const
      };

      const result = await GDPRComplianceService.recordConsent(
        testUser._id.toString(),
        'marketing',
        refusalData
      );

      expect(result.consentGiven).toBe(false);
      expect(result.isActive).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      // Simulate an error by passing invalid data
      const invalidConsentData = null as any;

      await expect(
        GDPRComplianceService.recordConsent(
          testUser._id.toString(),
          'data_processing',
          invalidConsentData
        )
      ).rejects.toThrow();
    });
  });

  describe('revokeConsent', () => {
    it('should revoke consent successfully', async () => {
      const revocationData = {
        userId: testUser._id.toString(),
        revocationMethod: 'button_click',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser'
      };

      const result = await GDPRComplianceService.revokeConsent(
        'test-uuid-12345',
        revocationData
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('test-uuid-12345');
      expect(result.userId).toBe(testUser._id.toString());
      expect(result.consentGiven).toBe(false);
      expect(result.isActive).toBe(false);
      expect(result.revokedAt).toBeInstanceOf(Date);
      expect(result.optInDetails.explicitConsent).toBe(false);
      expect(result.optInDetails.consentText).toBe('Consent revoked');
      expect(result.source).toBe('consent_revocation');
    });

    it('should map different revocation methods correctly', async () => {
      const emailRevocationData = {
        userId: testUser._id.toString(),
        revocationMethod: 'email_request',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser'
      };

      const result = await GDPRComplianceService.revokeConsent(
        'test-uuid-12345',
        emailRevocationData
      );

      expect(result.consentMethod).toBe('email_confirmation');
    });

    it('should handle unknown revocation methods', async () => {
      const unknownRevocationData = {
        userId: testUser._id.toString(),
        revocationMethod: 'unknown_method',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser'
      };

      const result = await GDPRComplianceService.revokeConsent(
        'test-uuid-12345',
        unknownRevocationData
      );

      expect(result.consentMethod).toBe('form_submission'); // Default fallback
    });
  });

  describe('handleAccessRequest', () => {
    it('should handle access request by user ID', async () => {
      const accessRequest = {
        userId: testUser._id.toString(),
        requestId: 'access-request-123'
      };

      const result = await GDPRComplianceService.handleAccessRequest(accessRequest);

      expect(result).toBeDefined();
      expect(result.requestId).toBe('access-request-123');
      expect(result.userId).toBe(testUser._id.toString());
      expect(result.email).toBe(testUser.email);
      expect(result.dataExported).toBeDefined();
      expect(result.dataExported.profile).toBeDefined();
      expect(result.dataExported.profile.email).toBe(testUser.email);
      expect(result.dataExported.forms).toHaveLength(1);
      expect(result.dataExported.submissions).toHaveLength(1);
      expect(result.exportFormat).toBe('json');
      expect(result.retentionNotice).toBeDefined();
      expect(result.dataProcessingPurposes).toBeDefined();
      expect(result.thirdPartySharing).toBeDefined();
      expect(result.userRights).toBeDefined();
      expect(result.requestDate).toBeInstanceOf(Date);
    });

    it('should handle access request by email', async () => {
      const accessRequest = {
        email: testUser.email,
        requestId: 'access-request-email'
      };

      const result = await GDPRComplianceService.handleAccessRequest(accessRequest);

      expect(result.requestId).toBe('access-request-email');
      expect(result.userId).toBe(testUser._id.toString());
      expect(result.email).toBe(testUser.email);
    });

    it('should generate request ID if not provided', async () => {
      const accessRequest = {
        userId: testUser._id.toString()
      };

      const result = await GDPRComplianceService.handleAccessRequest(accessRequest);

      expect(result.requestId).toBe('test-uuid-12345');
    });

    it('should throw error when user not found', async () => {
      const accessRequest = {
        email: 'nonexistent@example.com'
      };

      await expect(
        GDPRComplianceService.handleAccessRequest(accessRequest)
      ).rejects.toThrow('User not found');
    });

    it('should include form and response data in export', async () => {
      const accessRequest = {
        userId: testUser._id.toString()
      };

      const result = await GDPRComplianceService.handleAccessRequest(accessRequest);

      expect(result.dataExported.forms[0]).toEqual({
        id: testForm._id,
        title: testForm.title,
        createdAt: testForm.createdAt,
        responses: testForm.analytics.totalSubmissions
      });

      expect(result.dataExported.submissions[0]).toEqual({
        id: testResponse._id,
        formId: testResponse.formId,
        submittedAt: testResponse.submittedAt,
        responses: testResponse.responses
      });
    });
  });

  describe('handleErasureRequest', () => {
    it('should handle complete erasure request', async () => {
      const erasureRequest = {
        userId: testUser._id.toString(),
        requestId: 'erasure-request-123',
        erasureScope: ['account_data', 'form_responses', 'forms', 'analytics_data']
      };

      const result = await GDPRComplianceService.handleErasureRequest(erasureRequest);

      expect(result).toBeDefined();
      expect(result.requestId).toBe('erasure-request-123');
      expect(result.userId).toBe(testUser._id.toString());
      expect(result.erasureCompleted).toBe(true);
      expect(result.erasureResults).toHaveLength(4);
      expect(result.retainedData).toBeDefined();
      expect(result.legalObligations).toBeDefined();

      // Check individual erasure results
      const accountResult = result.erasureResults.find(r => r.dataCategory === 'account_data');
      expect(accountResult?.success).toBe(true);

      const responsesResult = result.erasureResults.find(r => r.dataCategory === 'form_responses');
      expect(responsesResult?.success).toBe(true);
      expect(responsesResult?.recordsAffected).toBe(1);

      const formsResult = result.erasureResults.find(r => r.dataCategory === 'forms');
      expect(formsResult?.success).toBe(true);
      expect(formsResult?.recordsAffected).toBe(1);

      const analyticsResult = result.erasureResults.find(r => r.dataCategory === 'analytics_data');
      expect(analyticsResult?.success).toBe(true);
    });

    it('should handle partial erasure request', async () => {
      const erasureRequest = {
        email: testUser.email,
        erasureScope: ['form_responses']
      };

      const result = await GDPRComplianceService.handleErasureRequest(erasureRequest);

      expect(result.erasureResults).toHaveLength(1);
      expect(result.erasureResults[0].dataCategory).toBe('form_responses');
      expect(result.erasureResults[0].success).toBe(true);
    });

    it('should generate request ID if not provided', async () => {
      const erasureRequest = {
        userId: testUser._id.toString(),
        erasureScope: ['account_data']
      };

      const result = await GDPRComplianceService.handleErasureRequest(erasureRequest);

      expect(result.requestId).toBe('test-uuid-12345');
    });

    it('should throw error when user not found', async () => {
      const erasureRequest = {
        email: 'nonexistent@example.com',
        erasureScope: ['account_data']
      };

      await expect(
        GDPRComplianceService.handleErasureRequest(erasureRequest)
      ).rejects.toThrow('User not found');
    });

    it('should verify data is actually erased from database', async () => {
      const erasureRequest = {
        userId: testUser._id.toString(),
        erasureScope: ['form_responses', 'forms']
      };

      // Verify data exists before erasure
      const responsesBefore = await FormResponse.find({ 'metadata.userId': testUser._id.toString() });
      const formsBefore = await Form.find({ userId: testUser._id });
      expect(responsesBefore).toHaveLength(1);
      expect(formsBefore).toHaveLength(1);

      await GDPRComplianceService.handleErasureRequest(erasureRequest);

      // Verify data is erased after request
      const responsesAfter = await FormResponse.find({ 'metadata.userId': testUser._id.toString() });
      const formsAfter = await Form.find({ userId: testUser._id });
      expect(responsesAfter).toHaveLength(0);
      expect(formsAfter).toHaveLength(0);
    });
  });

  describe('handlePortabilityRequest', () => {
    it('should handle portability request in JSON format', async () => {
      const portabilityRequest = {
        userId: testUser._id.toString(),
        requestId: 'portability-request-123',
        exportFormat: 'json' as const
      };

      const result = await GDPRComplianceService.handlePortabilityRequest(portabilityRequest);

      expect(result).toBeDefined();
      expect(result.requestId).toBe('portability-request-123');
      expect(result.userId).toBe(testUser._id.toString());
      expect(result.exportFormat).toBe('json');
      expect(result.portableData).toBeDefined();
      expect(result.portableData.forms).toHaveLength(1);
      expect(result.portableData.submissions).toHaveLength(1);
      expect(result.dataCategories).toContain('forms');
      expect(result.dataCategories).toContain('submissions');
      expect(result.technicalDetails).toEqual({
        encoding: 'UTF-8',
        structure: 'JSON',
        apiVersion: '1.0'
      });
    });

    it('should handle portability request in CSV format', async () => {
      const portabilityRequest = {
        email: testUser.email,
        exportFormat: 'csv' as const
      };

      const result = await GDPRComplianceService.handlePortabilityRequest(portabilityRequest);

      expect(result.exportFormat).toBe('csv');
      expect(typeof result.portableData).toBe('string');
      expect(result.portableData).toContain('forms,');
      expect(result.portableData).toContain('submissions,');
    });

    it('should handle portability request in XML format', async () => {
      const portabilityRequest = {
        userId: testUser._id.toString(),
        exportFormat: 'xml' as const
      };

      const result = await GDPRComplianceService.handlePortabilityRequest(portabilityRequest);

      expect(result.exportFormat).toBe('xml');
      expect(typeof result.portableData).toBe('string');
      expect(result.portableData).toContain('<data>');
      expect(result.portableData).toContain('<forms>');
      expect(result.portableData).toContain('</data>');
    });

    it('should default to JSON format when not specified', async () => {
      const portabilityRequest = {
        userId: testUser._id.toString()
      };

      const result = await GDPRComplianceService.handlePortabilityRequest(portabilityRequest);

      expect(result.exportFormat).toBe('json');
      expect(result.requestId).toBe('test-uuid-12345');
    });

    it('should only include user-provided data', async () => {
      const portabilityRequest = {
        userId: testUser._id.toString(),
        exportFormat: 'json' as const
      };

      const result = await GDPRComplianceService.handlePortabilityRequest(portabilityRequest);

      // Should include form structure (user-created)
      expect(result.portableData.forms[0]).toHaveProperty('title');
      expect(result.portableData.forms[0]).toHaveProperty('fields');
      expect(result.portableData.forms[0]).toHaveProperty('customization');

      // Should include submissions where user is the submitter
      expect(result.portableData.submissions[0]).toHaveProperty('responses');
      expect(result.portableData.submissions[0]).toHaveProperty('submittedAt');
    });
  });

  describe('generateDataProcessingRecord', () => {
    it('should generate data processing record for a form', async () => {
      const result = await GDPRComplianceService.generateDataProcessingRecord(testForm._id.toString());

      expect(result).toBeDefined();
      expect(result.id).toBe('test-uuid-12345');
      expect(result.formId).toBe(testForm._id.toString());
      expect(result.formTitle).toBe(testForm.title);
      expect(result.dataController).toBeDefined();
      expect(result.dataController.name).toBe('Form Platform');
      expect(result.processingPurpose).toContain('form_submission_processing');
      expect(result.legalBasis).toBe('consent');
      expect(result.dataCategories).toContain('form_responses');
      expect(result.dataSubjects).toContain('form_respondents');
      expect(result.recipients).toContain('form_owner');
      expect(result.securityMeasures).toContain('encryption_in_transit');
      expect(result.dataSubjectRights).toContain('right_of_access');
      expect(result.retentionPeriod).toBe(365);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should extract data categories based on field types', async () => {
      // Add different field types to the form
      testForm.fields.push(
        {
          id: 'email-field',
          type: 'email',
          label: 'Email Address',
          required: true,
          order: 1,
          conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
          answerRecall: { enabled: false },
          calculation: { enabled: false, dependencies: [], displayType: 'number' },
          prefill: { enabled: false },
          properties: {}
        },
        {
          id: 'phone-field',
          type: 'phone',
          label: 'Phone Number',
          required: false,
          order: 2,
          conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
          answerRecall: { enabled: false },
          calculation: { enabled: false, dependencies: [], displayType: 'number' },
          prefill: { enabled: false },
          properties: {}
        }
      );
      await testForm.save();

      const result = await GDPRComplianceService.generateDataProcessingRecord(testForm._id.toString());

      expect(result.dataCategories).toContain('contact_information');
      expect(result.dataCategories).toContain('form_responses');
    });

    it('should throw error when form not found', async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId().toString();

      await expect(
        GDPRComplianceService.generateDataProcessingRecord(nonExistentFormId)
      ).rejects.toThrow('Form not found');
    });

    it('should use environment variables for data controller information', async () => {
      process.env.DATA_CONTROLLER_EMAIL = 'privacy@testcompany.com';
      process.env.DATA_CONTROLLER_ADDRESS = '123 Test Street, Test City';

      const result = await GDPRComplianceService.generateDataProcessingRecord(testForm._id.toString());

      expect(result.dataController.email).toBe('privacy@testcompany.com');
      expect(result.dataController.address).toBe('123 Test Street, Test City');

      // Clean up
      delete process.env.DATA_CONTROLLER_EMAIL;
      delete process.env.DATA_CONTROLLER_ADDRESS;
    });
  });

  describe('validateFormCompliance', () => {
    it('should validate compliant form successfully', async () => {
      // Make form GDPR compliant
      testForm.settings.gdpr = {
        enabled: true,
        consentText: 'I agree to the processing of my personal data for the purpose of responding to this form.',
        privacyPolicyUrl: 'https://example.com/privacy',
        dataRetentionDays: 365
      };
      await testForm.save();

      const result = await GDPRComplianceService.validateFormCompliance(testForm._id.toString());

      expect(result).toBeDefined();
      expect(result.formId).toBe(testForm._id.toString());
      expect(result.formTitle).toBe(testForm.title);
      expect(result.isCompliant).toBe(true);
      expect(result.complianceScore).toBeGreaterThan(80);
      expect(result.validationResults).toHaveLength(0); // No violations
      expect(result.recommendations).toHaveLength(0);
      expect(result.validatedAt).toBeInstanceOf(Date);
    });

    it('should identify non-compliant form with critical issues', async () => {
      // Form without GDPR settings (non-compliant)
      const result = await GDPRComplianceService.validateFormCompliance(testForm._id.toString());

      expect(result.isCompliant).toBe(false);
      expect(result.complianceScore).toBeLessThan(80);
      expect(result.validationResults.length).toBeGreaterThan(0);

      const criticalIssues = result.validationResults.filter(r => r.severity === 'critical');
      expect(criticalIssues.length).toBeGreaterThan(0);

      // Check for specific compliance issues
      const gdprEnabledIssue = result.validationResults.find(r => r.requirement === 'gdpr_enabled');
      expect(gdprEnabledIssue).toBeDefined();
      expect(gdprEnabledIssue!.compliant).toBe(false);
      expect(gdprEnabledIssue!.severity).toBe('critical');

      const consentTextIssue = result.validationResults.find(r => r.requirement === 'consent_text');
      expect(consentTextIssue).toBeDefined();
      expect(consentTextIssue!.compliant).toBe(false);
    });

    it('should identify sensitive data fields', async () => {
      // Add sensitive fields to form
      testForm.fields.push({
        id: 'password-field',
        type: 'password',
        label: 'Password',
        required: true,
        order: 1,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      });
      await testForm.save();

      const result = await GDPRComplianceService.validateFormCompliance(testForm._id.toString());

      const sensitiveDataIssue = result.validationResults.find(r => r.requirement === 'sensitive_data');
      expect(sensitiveDataIssue).toBeDefined();
      expect(sensitiveDataIssue!.compliant).toBe(false);
      expect(sensitiveDataIssue!.severity).toBe('high');
      expect(sensitiveDataIssue!.message).toContain('Password');
    });

    it('should validate data retention period', async () => {
      // Set invalid retention period
      testForm.settings.gdpr = {
        enabled: true,
        consentText: 'I agree',
        privacyPolicyUrl: 'https://example.com/privacy',
        dataRetentionDays: 3000 // Too long (> 7 years)
      };
      await testForm.save();

      const result = await GDPRComplianceService.validateFormCompliance(testForm._id.toString());

      const retentionIssue = result.validationResults.find(r => r.requirement === 'data_retention');
      expect(retentionIssue).toBeDefined();
      expect(retentionIssue!.compliant).toBe(false);
      expect(retentionIssue!.severity).toBe('medium');
    });

    it('should calculate compliance score correctly', async () => {
      // Partially compliant form
      testForm.settings.gdpr = {
        enabled: true,
        consentText: 'I agree to data processing',
        dataRetentionDays: 365
        // Missing privacy policy URL
      };
      await testForm.save();

      const result = await GDPRComplianceService.validateFormCompliance(testForm._id.toString());

      expect(result.complianceScore).toBeGreaterThan(0);
      expect(result.complianceScore).toBeLessThan(100);
      expect(result.validationResults.length).toBe(1); // Only privacy policy missing
      
      const privacyPolicyIssue = result.validationResults.find(r => r.requirement === 'privacy_policy');
      expect(privacyPolicyIssue!.severity).toBe('high');
    });

    it('should throw error when form not found', async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId().toString();

      await expect(
        GDPRComplianceService.validateFormCompliance(nonExistentFormId)
      ).rejects.toThrow('Form not found');
    });

    it('should provide actionable recommendations', async () => {
      const result = await GDPRComplianceService.validateFormCompliance(testForm._id.toString());

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations).toContain('Enable GDPR compliance in form settings');
      expect(result.recommendations).toContain('Add clear consent text explaining data processing');
      expect(result.recommendations).toContain('Provide a link to your privacy policy');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Simulate database error by using invalid user ID
      const invalidUserId = 'invalid-user-id';
      
      await expect(
        GDPRComplianceService.handleAccessRequest({
          userId: invalidUserId
        })
      ).rejects.toThrow();
    });

    it('should handle invalid ObjectId formats', async () => {
      const invalidId = 'invalid-object-id';

      await expect(
        GDPRComplianceService.generateDataProcessingRecord(invalidId)
      ).rejects.toThrow();
    });

    it('should handle forms with no fields', async () => {
      const emptyForm = await Form.create({
        ...TestUtils.createTestForm(testUser._id.toString()),
        title: 'Empty Form',
        fields: []
      });

      const result = await GDPRComplianceService.generateDataProcessingRecord(emptyForm._id.toString());

      expect(result.dataCategories).toHaveLength(0);
    });

    it('should handle user with no forms or responses', async () => {
      // Create a new user without forms or responses
      const newUser = await User.create({
        ...TestUtils.createTestUser(),
        email: 'newuser@test.com'
      });

      const result = await GDPRComplianceService.handleAccessRequest({
        userId: newUser._id.toString()
      });

      expect(result.dataExported.forms).toHaveLength(0);
      expect(result.dataExported.submissions).toHaveLength(0);
      expect(result.dataExported.profile.email).toBe('newuser@test.com');
    });
  });
});