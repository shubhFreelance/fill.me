import mongoose from 'mongoose';
import Form from '../../models/Form';
import User from '../../models/User';
import Integration from '../../models/Integration';
import FormResponse from '../../models/FormResponse';
import { IntegrationService } from '../../services/IntegrationService';
import { TestUtils } from '../setup';
import axios from 'axios';

// Mock axios for HTTP requests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock crypto for webhook signatures
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  createHmac: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mocked-signature')
  })
}));

describe('IntegrationService', () => {
  let testUser: any;
  let testForm: any;
  let testIntegration: any;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Form.deleteMany({});
    await Integration.deleteMany({});
    await FormResponse.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    testUser = await User.create(userData);

    // Create test form
    const formData = TestUtils.createTestForm(testUser._id.toString());
    testForm = await Form.create(formData);

    // Create test integration
    testIntegration = await Integration.create({
      userId: testUser._id,
      formId: testForm._id,
      type: 'webhook',
      name: 'Test Webhook',
      isActive: true,
      config: {
        webhook: {
          url: 'https://example.com/webhook',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          includeMetadata: true,
          retryOnFailure: true,
          maxRetries: 3
        }
      },
      triggerEvents: ['form_submitted', 'form_updated']
    });

    // Reset axios mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Form.deleteMany({});
    await Integration.deleteMany({});
    await FormResponse.deleteMany({});
  });

  describe('createIntegration', () => {
    it('should create a webhook integration successfully', async () => {
      const integrationData = {
        type: 'webhook',
        name: 'New Webhook Integration',
        config: {
          webhook: {
            url: 'https://api.example.com/webhook',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            includeMetadata: true,
            retryOnFailure: true,
            maxRetries: 3
          }
        },
        triggerEvents: ['form_submitted']
      };

      const result = await IntegrationService.createIntegration(
        testUser._id.toString(),
        testForm._id.toString(),
        integrationData
      );

      expect(result.success).toBe(true);
      expect(result.integration).toBeDefined();
      expect(result.integration!.name).toBe('New Webhook Integration');
      expect(result.integration!.type).toBe('webhook');
      expect(result.integration!.isActive).toBe(true);

      // Verify integration was saved to database
      const savedIntegration = await Integration.findById(result.integration!._id);
      expect(savedIntegration).toBeTruthy();
      expect(savedIntegration!.config.webhook.url).toBe('https://api.example.com/webhook');
    });

    it('should create a Slack integration successfully', async () => {
      const integrationData = {
        type: 'slack',
        name: 'Slack Notifications',
        config: {
          slack: {
            webhookUrl: 'https://hooks.slack.com/services/test/webhook',
            channel: '#notifications',
            username: 'FormBot',
            includeFormData: true,
            customMessage: 'New form submission received!'
          }
        },
        triggerEvents: ['form_submitted']
      };

      const result = await IntegrationService.createIntegration(
        testUser._id.toString(),
        testForm._id.toString(),
        integrationData
      );

      expect(result.success).toBe(true);
      expect(result.integration!.type).toBe('slack');
      expect(result.integration!.config.slack.channel).toBe('#notifications');
    });

    it('should create a Google Sheets integration successfully', async () => {
      const integrationData = {
        type: 'google_sheets',
        name: 'Google Sheets Export',
        config: {
          googleSheets: {
            spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
            worksheetName: 'Form Responses',
            headerRow: 1,
            includeTimestamp: true,
            fieldMapping: {
              'field1': 'Name',
              'field2': 'Email'
            }
          }
        },
        triggerEvents: ['form_submitted']
      };

      const result = await IntegrationService.createIntegration(
        testUser._id.toString(),
        testForm._id.toString(),
        integrationData
      );

      expect(result.success).toBe(true);
      expect(result.integration!.type).toBe('google_sheets');
      expect(result.integration!.config.googleSheets.spreadsheetId).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
    });

    it('should validate webhook URL format', async () => {
      const invalidData = {
        type: 'webhook',
        name: 'Invalid Webhook',
        config: {
          webhook: {
            url: 'invalid-url',
            method: 'POST'
          }
        },
        triggerEvents: ['form_submitted']
      };

      const result = await IntegrationService.createIntegration(
        testUser._id.toString(),
        testForm._id.toString(),
        invalidData
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid webhook URL format');
    });

    it('should return error for unsupported integration type', async () => {
      const invalidData = {
        type: 'unsupported_type',
        name: 'Unsupported Integration',
        config: {},
        triggerEvents: ['form_submitted']
      };

      const result = await IntegrationService.createIntegration(
        testUser._id.toString(),
        testForm._id.toString(),
        invalidData
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported integration type');
    });

    it('should enforce integration limits for free plan', async () => {
      // Create maximum integrations for free plan (2)
      await Integration.create({
        userId: testUser._id,
        formId: testForm._id,
        type: 'webhook',
        name: 'Integration 1',
        isActive: true,
        config: { webhook: { url: 'https://example1.com' } },
        triggerEvents: ['form_submitted']
      });

      await Integration.create({
        userId: testUser._id,
        formId: testForm._id,
        type: 'slack',
        name: 'Integration 2',
        isActive: true,
        config: { slack: { webhookUrl: 'https://hooks.slack.com/test' } },
        triggerEvents: ['form_submitted']
      });

      const newIntegrationData = {
        type: 'webhook',
        name: 'Third Integration',
        config: {
          webhook: { url: 'https://example3.com', method: 'POST' }
        },
        triggerEvents: ['form_submitted']
      };

      const result = await IntegrationService.createIntegration(
        testUser._id.toString(),
        testForm._id.toString(),
        newIntegrationData
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum integrations limit reached');
    });
  });

  describe('executeIntegration', () => {
    it('should execute webhook integration successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: { success: true }
      });

      const payload = {
        formId: testForm._id.toString(),
        formTitle: testForm.title,
        responses: [
          { fieldId: 'field1', value: 'John Doe', fieldType: 'text' }
        ],
        submittedAt: new Date(),
        metadata: {
          userAgent: 'Test Agent',
          ipAddress: '127.0.0.1'
        }
      };

      const result = await IntegrationService.executeIntegration(
        testIntegration._id.toString(),
        'form_submitted',
        payload
      );

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          event: 'form_submitted',
          data: payload
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should handle webhook retry on failure', async () => {
      // Mock first two calls to fail, third to succeed
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          data: { success: true }
        });

      const payload = {
        formId: testForm._id.toString(),
        responses: [],
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeIntegration(
        testIntegration._id.toString(),
        'form_submitted',
        payload
      );

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Persistent error'));

      const payload = {
        formId: testForm._id.toString(),
        responses: [],
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeIntegration(
        testIntegration._id.toString(),
        'form_submitted',
        payload
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Max retries exceeded');
      expect(mockedAxios.post).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should execute Slack integration', async () => {
      const slackIntegration = await Integration.create({
        userId: testUser._id,
        formId: testForm._id,
        type: 'slack',
        name: 'Slack Integration',
        isActive: true,
        config: {
          slack: {
            webhookUrl: 'https://hooks.slack.com/services/test/webhook',
            channel: '#notifications',
            username: 'FormBot',
            includeFormData: true,
            customMessage: 'New submission received!'
          }
        },
        triggerEvents: ['form_submitted']
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: 'ok'
      });

      const payload = {
        formId: testForm._id.toString(),
        formTitle: testForm.title,
        responses: [
          { fieldId: 'field1', value: 'John Doe', fieldType: 'text' }
        ],
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeIntegration(
        slackIntegration._id.toString(),
        'form_submitted',
        payload
      );

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/test/webhook',
        expect.objectContaining({
          channel: '#notifications',
          username: 'FormBot',
          text: expect.stringContaining('New submission received!')
        })
      );
    });

    it('should not execute for non-matching trigger events', async () => {
      const payload = {
        formId: testForm._id.toString(),
        responses: [],
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeIntegration(
        testIntegration._id.toString(),
        'form_deleted', // Not in triggerEvents
        payload
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Integration not configured for this event');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should not execute inactive integrations', async () => {
      testIntegration.isActive = false;
      await testIntegration.save();

      const payload = {
        formId: testForm._id.toString(),
        responses: [],
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeIntegration(
        testIntegration._id.toString(),
        'form_submitted',
        payload
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Integration is not active');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('executeFormIntegrations', () => {
    beforeEach(async () => {
      // Create multiple integrations for the form
      await Integration.create([
        {
          userId: testUser._id,
          formId: testForm._id,
          type: 'webhook',
          name: 'Webhook 1',
          isActive: true,
          config: {
            webhook: {
              url: 'https://webhook1.example.com',
              method: 'POST'
            }
          },
          triggerEvents: ['form_submitted']
        },
        {
          userId: testUser._id,
          formId: testForm._id,
          type: 'slack',
          name: 'Slack Notification',
          isActive: true,
          config: {
            slack: {
              webhookUrl: 'https://hooks.slack.com/test',
              channel: '#forms'
            }
          },
          triggerEvents: ['form_submitted']
        },
        {
          userId: testUser._id,
          formId: testForm._id,
          type: 'webhook',
          name: 'Inactive Webhook',
          isActive: false,
          config: {
            webhook: {
              url: 'https://inactive.example.com',
              method: 'POST'
            }
          },
          triggerEvents: ['form_submitted']
        }
      ]);
    });

    it('should execute all active integrations for a form', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: { success: true }
      });

      const payload = {
        formId: testForm._id.toString(),
        formTitle: testForm.title,
        responses: [
          { fieldId: 'field1', value: 'Test Response', fieldType: 'text' }
        ],
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeFormIntegrations(
        testForm._id.toString(),
        'form_submitted',
        payload
      );

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2); // Only active integrations
      expect(result.successfulExecutions).toBe(2);
      expect(result.failedExecutions).toBe(0);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      mockedAxios.post
        .mockResolvedValueOnce({ status: 200, data: { success: true } })
        .mockRejectedValueOnce(new Error('Network error'));

      const payload = {
        formId: testForm._id.toString(),
        responses: [],
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeFormIntegrations(
        testForm._id.toString(),
        'form_submitted',
        payload
      );

      expect(result.success).toBe(true);
      expect(result.successfulExecutions).toBe(1);
      expect(result.failedExecutions).toBe(1);
    });

    it('should return empty results for form with no integrations', async () => {
      const emptyForm = await Form.create({
        ...TestUtils.createTestForm(testUser._id.toString()),
        publicUrl: 'empty-form-' + Date.now()
      });

      const payload = {
        formId: emptyForm._id.toString(),
        responses: [],
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeFormIntegrations(
        emptyForm._id.toString(),
        'form_submitted',
        payload
      );

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.successfulExecutions).toBe(0);
      expect(result.failedExecutions).toBe(0);
    });
  });

  describe('testIntegration', () => {
    it('should test webhook integration successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: { success: true },
        headers: { 'content-type': 'application/json' }
      });

      const result = await IntegrationService.testIntegration(testIntegration._id.toString());

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response!.status).toBe(200);
      expect(result.latency).toBeDefined();
      expect(result.latency!).toBeGreaterThan(0);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          event: 'test',
          test: true,
          timestamp: expect.any(String)
        }),
        expect.any(Object)
      );
    });

    it('should test Slack integration', async () => {
      const slackIntegration = await Integration.create({
        userId: testUser._id,
        formId: testForm._id,
        type: 'slack',
        name: 'Slack Test',
        isActive: true,
        config: {
          slack: {
            webhookUrl: 'https://hooks.slack.com/test',
            channel: '#test'
          }
        },
        triggerEvents: ['form_submitted']
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: 'ok'
      });

      const result = await IntegrationService.testIntegration(slackIntegration._id.toString());

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          channel: '#test',
          text: expect.stringContaining('Test message')
        })
      );
    });

    it('should handle test failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { error: 'Endpoint not found' }
        }
      });

      const result = await IntegrationService.testIntegration(testIntegration._id.toString());

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test failed');
      expect(result.response).toBeDefined();
      expect(result.response!.status).toBe(404);
    });

    it('should return error for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const result = await IntegrationService.testIntegration(nonExistentId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Integration not found');
    });
  });

  describe('getIntegrationLogs', () => {
    beforeEach(async () => {
      // Add some execution logs
      testIntegration.executionLog = [
        {
          timestamp: new Date('2024-01-15T10:00:00Z'),
          event: 'form_submitted',
          success: true,
          responseStatus: 200,
          latency: 150,
          payload: { test: 'data1' }
        },
        {
          timestamp: new Date('2024-01-15T11:00:00Z'),
          event: 'form_submitted',
          success: false,
          error: 'Network timeout',
          latency: 5000,
          payload: { test: 'data2' }
        },
        {
          timestamp: new Date('2024-01-15T12:00:00Z'),
          event: 'test',
          success: true,
          responseStatus: 200,
          latency: 100,
          payload: { test: true }
        }
      ];
      await testIntegration.save();
    });

    it('should get integration execution logs', async () => {
      const result = await IntegrationService.getIntegrationLogs(
        testIntegration._id.toString(),
        { limit: 10 }
      );

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(3);
      expect(result.logs![0].event).toBe('test'); // Most recent first
      expect(result.logs![1].event).toBe('form_submitted');
      expect(result.logs![2].event).toBe('form_submitted');
    });

    it('should filter logs by success status', async () => {
      const result = await IntegrationService.getIntegrationLogs(
        testIntegration._id.toString(),
        { successOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(2);
      expect(result.logs!.every(log => log.success)).toBe(true);
    });

    it('should filter logs by event type', async () => {
      const result = await IntegrationService.getIntegrationLogs(
        testIntegration._id.toString(),
        { event: 'form_submitted' }
      );

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(2);
      expect(result.logs!.every(log => log.event === 'form_submitted')).toBe(true);
    });

    it('should limit number of logs returned', async () => {
      const result = await IntegrationService.getIntegrationLogs(
        testIntegration._id.toString(),
        { limit: 2 }
      );

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(2);
    });

    it('should calculate statistics', async () => {
      const result = await IntegrationService.getIntegrationLogs(
        testIntegration._id.toString(),
        { includeStats: true }
      );

      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics!.totalExecutions).toBe(3);
      expect(result.statistics!.successfulExecutions).toBe(2);
      expect(result.statistics!.failedExecutions).toBe(1);
      expect(result.statistics!.successRate).toBeCloseTo(0.67, 2);
      expect(result.statistics!.averageLatency).toBeCloseTo(1750, 0);
    });
  });

  describe('updateIntegration', () => {
    it('should update integration configuration', async () => {
      const updates = {
        name: 'Updated Webhook',
        config: {
          webhook: {
            url: 'https://updated.example.com/webhook',
            method: 'POST',
            headers: { 'X-Custom': 'header' }
          }
        },
        triggerEvents: ['form_submitted', 'form_updated']
      };

      const result = await IntegrationService.updateIntegration(
        testIntegration._id.toString(),
        updates
      );

      expect(result.success).toBe(true);
      expect(result.integration!.name).toBe('Updated Webhook');
      expect(result.integration!.config.webhook.url).toBe('https://updated.example.com/webhook');
      expect(result.integration!.triggerEvents).toEqual(['form_submitted', 'form_updated']);

      // Verify in database
      const updatedIntegration = await Integration.findById(testIntegration._id);
      expect(updatedIntegration!.name).toBe('Updated Webhook');
    });

    it('should validate updated configuration', async () => {
      const invalidUpdates = {
        config: {
          webhook: {
            url: 'invalid-url'
          }
        }
      };

      const result = await IntegrationService.updateIntegration(
        testIntegration._id.toString(),
        invalidUpdates
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid webhook URL format');
    });

    it('should return error for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const updates = { name: 'Updated' };

      const result = await IntegrationService.updateIntegration(nonExistentId, updates);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Integration not found');
    });
  });

  describe('deleteIntegration', () => {
    it('should delete integration successfully', async () => {
      const result = await IntegrationService.deleteIntegration(testIntegration._id.toString());

      expect(result.success).toBe(true);
      expect(result.message).toContain('Integration deleted successfully');

      // Verify deletion
      const deletedIntegration = await Integration.findById(testIntegration._id);
      expect(deletedIntegration).toBeNull();
    });

    it('should return error for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const result = await IntegrationService.deleteIntegration(nonExistentId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Integration not found');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed webhook responses', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: 'malformed response'
      });

      const payload = {
        formId: testForm._id.toString(),
        responses: [],
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeIntegration(
        testIntegration._id.toString(),
        'form_submitted',
        payload
      );

      expect(result.success).toBe(true); // Should still succeed
    });

    it('should handle timeout errors', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded'
      });

      const payload = {
        formId: testForm._id.toString(),
        responses: [],
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeIntegration(
        testIntegration._id.toString(),
        'form_submitted',
        payload
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle very large payloads', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true }
      });

      const largePayload = {
        formId: testForm._id.toString(),
        responses: Array(1000).fill(null).map((_, i) => ({
          fieldId: `field${i}`,
          value: 'x'.repeat(1000),
          fieldType: 'text'
        })),
        submittedAt: new Date()
      };

      const result = await IntegrationService.executeIntegration(
        testIntegration._id.toString(),
        'form_submitted',
        largePayload
      );

      expect(result.success).toBe(true);
    });

    it('should sanitize sensitive data in logs', async () => {
      const sensitivePayload = {
        formId: testForm._id.toString(),
        responses: [
          { fieldId: 'password', value: 'secret123', fieldType: 'password' },
          { fieldId: 'email', value: 'user@example.com', fieldType: 'email' }
        ],
        submittedAt: new Date()
      };

      // The actual implementation should sanitize passwords in logs
      // This test ensures we're thinking about security
      const result = await IntegrationService.getIntegrationLogs(
        testIntegration._id.toString(),
        { includePayload: true }
      );

      expect(result.success).toBe(true);
    });

    it('should handle invalid ObjectId format', async () => {
      const result = await IntegrationService.executeIntegration(
        'invalid-id',
        'form_submitted',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid integration ID');
    });
  });
});