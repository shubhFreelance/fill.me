import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import Form from '../../models/Form';
import Integration from '../../models/Integration';
import { TestUtils } from '../setup';

describe('Integrations API Integration Tests', () => {
  let testUser: any;
  let testForm: any;
  let authToken: string;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Form.deleteMany({});
    await Integration.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    testUser = await User.create(userData);
    authToken = TestUtils.generateToken(testUser._id.toString(), testUser.email);

    // Create test form
    const formData = TestUtils.createTestForm(testUser._id.toString());
    testForm = await Form.create(formData);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Form.deleteMany({});
    await Integration.deleteMany({});
  });

  describe('POST /api/integrations', () => {
    it('should create a webhook integration successfully', async () => {
      const integrationData = {
        formId: testForm._id,
        type: 'webhook',
        name: 'Test Webhook',
        config: {
          webhook: {
            url: 'https://api.example.com/webhook',
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
      };

      const response = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(integrationData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.integration).toBeDefined();
      expect(response.body.integration.name).toBe('Test Webhook');
      expect(response.body.integration.type).toBe('webhook');
      expect(response.body.integration.isActive).toBe(true);
      expect(response.body.integration.triggerEvents).toEqual(['form_submitted', 'form_updated']);

      // Verify integration was saved to database
      const savedIntegration = await Integration.findById(response.body.integration._id);
      expect(savedIntegration).toBeTruthy();
      expect(savedIntegration!.config.webhook.url).toBe('https://api.example.com/webhook');
    });

    it('should create a Slack integration successfully', async () => {
      const integrationData = {
        formId: testForm._id,
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

      const response = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(integrationData)
        .expect(201);

      expect(response.body.integration.type).toBe('slack');
      expect(response.body.integration.config.slack.channel).toBe('#notifications');
    });

    it('should create a Google Sheets integration successfully', async () => {
      const integrationData = {
        formId: testForm._id,
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

      const response = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(integrationData)
        .expect(201);

      expect(response.body.integration.type).toBe('google_sheets');
      expect(response.body.integration.config.googleSheets.spreadsheetId)
        .toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
    });

    it('should validate integration data', async () => {
      const invalidData = {
        formId: testForm._id,
        type: 'webhook',
        name: 'Invalid Webhook',
        config: {
          webhook: {
            url: 'invalid-url', // Invalid URL format
            method: 'POST'
          }
        }
      };

      const response = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid webhook URL format');
    });

    it('should return error for non-existent form', async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId();
      const integrationData = {
        formId: nonExistentFormId,
        type: 'webhook',
        name: 'Test Webhook',
        config: {
          webhook: {
            url: 'https://api.example.com/webhook',
            method: 'POST'
          }
        }
      };

      const response = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(integrationData)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Form not found');
    });

    it('should return error for form belonging to other user', async () => {
      const otherUser = await User.create({
        ...TestUtils.createTestUser(),
        email: 'other@test.com'
      });
      const otherForm = await Form.create({
        ...TestUtils.createTestForm(otherUser._id.toString()),
        publicUrl: 'other-form-' + Date.now()
      });

      const integrationData = {
        formId: otherForm._id,
        type: 'webhook',
        name: 'Unauthorized Webhook',
        config: {
          webhook: {
            url: 'https://api.example.com/webhook',
            method: 'POST'
          }
        }
      };

      const response = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(integrationData)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should enforce integration limits for free plan', async () => {
      // Create maximum integrations for free plan (2)
      await Integration.create([
        {
          userId: testUser._id,
          formId: testForm._id,
          type: 'webhook',
          name: 'Integration 1',
          isActive: true,
          config: { webhook: { url: 'https://example1.com' } },
          triggerEvents: ['form_submitted']
        },
        {
          userId: testUser._id,
          formId: testForm._id,
          type: 'slack',
          name: 'Integration 2',
          isActive: true,
          config: { slack: { webhookUrl: 'https://hooks.slack.com/test' } },
          triggerEvents: ['form_submitted']
        }
      ]);

      const integrationData = {
        formId: testForm._id,
        type: 'webhook',
        name: 'Third Integration',
        config: {
          webhook: { url: 'https://example3.com', method: 'POST' }
        },
        triggerEvents: ['form_submitted']
      };

      const response = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(integrationData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Maximum integrations limit reached');
    });
  });

  describe('GET /api/integrations/form/:formId', () => {
    beforeEach(async () => {
      // Create test integrations
      await Integration.create([
        {
          userId: testUser._id,
          formId: testForm._id,
          type: 'webhook',
          name: 'Webhook Integration',
          isActive: true,
          config: { webhook: { url: 'https://webhook.example.com' } },
          triggerEvents: ['form_submitted']
        },
        {
          userId: testUser._id,
          formId: testForm._id,
          type: 'slack',
          name: 'Slack Integration',
          isActive: false,
          config: { slack: { webhookUrl: 'https://hooks.slack.com/test' } },
          triggerEvents: ['form_submitted']
        }
      ]);
    });

    it('should get all integrations for a form', async () => {
      const response = await request(app)
        .get(`/api/integrations/form/${testForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.integrations).toHaveLength(2);
      
      const webhookIntegration = response.body.integrations.find(
        (i: any) => i.type === 'webhook'
      );
      expect(webhookIntegration).toBeDefined();
      expect(webhookIntegration!.name).toBe('Webhook Integration');
      expect(webhookIntegration!.isActive).toBe(true);

      const slackIntegration = response.body.integrations.find(
        (i: any) => i.type === 'slack'
      );
      expect(slackIntegration).toBeDefined();
      expect(slackIntegration!.isActive).toBe(false);
    });

    it('should filter integrations by active status', async () => {
      const response = await request(app)
        .get(`/api/integrations/form/${testForm._id}?activeOnly=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.integrations).toHaveLength(1);
      expect(response.body.integrations[0].isActive).toBe(true);
      expect(response.body.integrations[0].type).toBe('webhook');
    });

    it('should filter integrations by type', async () => {
      const response = await request(app)
        .get(`/api/integrations/form/${testForm._id}?type=slack`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.integrations).toHaveLength(1);
      expect(response.body.integrations[0].type).toBe('slack');
    });

    it('should return empty array for form with no integrations', async () => {
      const emptyForm = await Form.create({
        ...TestUtils.createTestForm(testUser._id.toString()),
        publicUrl: 'empty-form-' + Date.now()
      });

      const response = await request(app)
        .get(`/api/integrations/form/${emptyForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.integrations).toHaveLength(0);
    });

    it('should return error for non-existent form', async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/integrations/form/${nonExistentFormId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Form not found');
    });
  });

  describe('GET /api/integrations/:id', () => {
    let testIntegration: any;

    beforeEach(async () => {
      testIntegration = await Integration.create({
        userId: testUser._id,
        formId: testForm._id,
        type: 'webhook',
        name: 'Test Integration',
        isActive: true,
        config: {
          webhook: {
            url: 'https://api.example.com/webhook',
            method: 'POST',
            headers: { 'Authorization': 'Bearer test' }
          }
        },
        triggerEvents: ['form_submitted']
      });
    });

    it('should get integration by ID', async () => {
      const response = await request(app)
        .get(`/api/integrations/${testIntegration._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.integration).toBeDefined();
      expect(response.body.integration._id).toBe(testIntegration._id.toString());
      expect(response.body.integration.name).toBe('Test Integration');
      expect(response.body.integration.config).toBeDefined();
    });

    it('should return error for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/integrations/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Integration not found');
    });

    it('should return error for integration belonging to other user', async () => {
      const otherUser = await User.create({
        ...TestUtils.createTestUser(),
        email: 'other@test.com'
      });
      const otherIntegration = await Integration.create({
        userId: otherUser._id,
        formId: testForm._id,
        type: 'webhook',
        name: 'Other User Integration',
        isActive: true,
        config: { webhook: { url: 'https://other.example.com' } },
        triggerEvents: ['form_submitted']
      });

      const response = await request(app)
        .get(`/api/integrations/${otherIntegration._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Integration not found');
    });
  });

  describe('PUT /api/integrations/:id', () => {
    let testIntegration: any;

    beforeEach(async () => {
      testIntegration = await Integration.create({
        userId: testUser._id,
        formId: testForm._id,
        type: 'webhook',
        name: 'Original Name',
        isActive: true,
        config: {
          webhook: {
            url: 'https://original.example.com/webhook',
            method: 'POST'
          }
        },
        triggerEvents: ['form_submitted']
      });
    });

    it('should update integration configuration', async () => {
      const updates = {
        name: 'Updated Integration',
        config: {
          webhook: {
            url: 'https://updated.example.com/webhook',
            method: 'POST',
            headers: { 'X-Custom': 'header' }
          }
        },
        triggerEvents: ['form_submitted', 'form_updated'],
        isActive: false
      };

      const response = await request(app)
        .put(`/api/integrations/${testIntegration._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.integration.name).toBe('Updated Integration');
      expect(response.body.integration.config.webhook.url).toBe('https://updated.example.com/webhook');
      expect(response.body.integration.triggerEvents).toEqual(['form_submitted', 'form_updated']);
      expect(response.body.integration.isActive).toBe(false);

      // Verify in database
      const updatedIntegration = await Integration.findById(testIntegration._id);
      expect(updatedIntegration!.name).toBe('Updated Integration');
      expect(updatedIntegration!.isActive).toBe(false);
    });

    it('should validate updated configuration', async () => {
      const invalidUpdates = {
        config: {
          webhook: {
            url: 'invalid-url'
          }
        }
      };

      const response = await request(app)
        .put(`/api/integrations/${testIntegration._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdates)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid webhook URL format');
    });

    it('should return error for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updates = { name: 'Updated' };

      const response = await request(app)
        .put(`/api/integrations/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Integration not found');
    });
  });

  describe('DELETE /api/integrations/:id', () => {
    let testIntegration: any;

    beforeEach(async () => {
      testIntegration = await Integration.create({
        userId: testUser._id,
        formId: testForm._id,
        type: 'webhook',
        name: 'Test Integration',
        isActive: true,
        config: { webhook: { url: 'https://test.example.com' } },
        triggerEvents: ['form_submitted']
      });
    });

    it('should delete integration successfully', async () => {
      const response = await request(app)
        .delete(`/api/integrations/${testIntegration._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Integration deleted successfully');

      // Verify deletion
      const deletedIntegration = await Integration.findById(testIntegration._id);
      expect(deletedIntegration).toBeNull();
    });

    it('should return error for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/integrations/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Integration not found');
    });
  });

  describe('POST /api/integrations/:id/test', () => {
    let testIntegration: any;

    beforeEach(async () => {
      testIntegration = await Integration.create({
        userId: testUser._id,
        formId: testForm._id,
        type: 'webhook',
        name: 'Test Integration',
        isActive: true,
        config: {
          webhook: {
            url: 'https://api.example.com/webhook',
            method: 'POST'
          }
        },
        triggerEvents: ['form_submitted']
      });
    });

    it('should test integration successfully', async () => {
      // Mock the external service response
      // In a real test, we would mock the HTTP client
      
      const response = await request(app)
        .post(`/api/integrations/${testIntegration._id}/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.testResult).toBeDefined();
      // The actual test result would depend on the integration type
      // and whether the external service is mocked
    });

    it('should return error for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/integrations/${nonExistentId}/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Integration not found');
    });

    it('should return error for inactive integration', async () => {
      testIntegration.isActive = false;
      await testIntegration.save();

      const response = await request(app)
        .post(`/api/integrations/${testIntegration._id}/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Integration is not active');
    });
  });

  describe('GET /api/integrations/:id/logs', () => {
    let testIntegration: any;

    beforeEach(async () => {
      testIntegration = await Integration.create({
        userId: testUser._id,
        formId: testForm._id,
        type: 'webhook',
        name: 'Test Integration',
        isActive: true,
        config: { webhook: { url: 'https://test.example.com' } },
        triggerEvents: ['form_submitted'],
        executionLog: [
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
          }
        ]
      });
    });

    it('should get integration execution logs', async () => {
      const response = await request(app)
        .get(`/api/integrations/${testIntegration._id}/logs`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.logs).toHaveLength(2);
      expect(response.body.logs[0].event).toBe('form_submitted');
      expect(response.body.logs[0].success).toBe(false); // Most recent first
    });

    it('should filter logs by success status', async () => {
      const response = await request(app)
        .get(`/api/integrations/${testIntegration._id}/logs?successOnly=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.logs).toHaveLength(1);
      expect(response.body.logs[0].success).toBe(true);
    });

    it('should limit number of logs returned', async () => {
      const response = await request(app)
        .get(`/api/integrations/${testIntegration._id}/logs?limit=1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.logs).toHaveLength(1);
    });

    it('should include statistics when requested', async () => {
      const response = await request(app)
        .get(`/api/integrations/${testIntegration._id}/logs?includeStats=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.statistics).toBeDefined();
      expect(response.body.statistics.totalExecutions).toBe(2);
      expect(response.body.statistics.successfulExecutions).toBe(1);
      expect(response.body.statistics.failedExecutions).toBe(1);
      expect(response.body.statistics.successRate).toBe(0.5);
    });

    it('should return error for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/integrations/${nonExistentId}/logs`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Integration not found');
    });
  });

  describe('POST /api/integrations/validate', () => {
    it('should validate webhook integration configuration', async () => {
      const config = {
        type: 'webhook',
        config: {
          webhook: {
            url: 'https://api.example.com/webhook',
            method: 'POST'
          }
        }
      };

      const response = await request(app)
        .post('/api/integrations/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(config)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.validation.isValid).toBe(true);
    });

    it('should validate Slack integration configuration', async () => {
      const config = {
        type: 'slack',
        config: {
          slack: {
            webhookUrl: 'https://hooks.slack.com/services/test/webhook'
          }
        }
      };

      const response = await request(app)
        .post('/api/integrations/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(config)
        .expect(200);

      expect(response.body.validation.isValid).toBe(true);
    });

    it('should detect invalid configuration', async () => {
      const config = {
        type: 'webhook',
        config: {
          webhook: {
            url: 'invalid-url'
          }
        }
      };

      const response = await request(app)
        .post('/api/integrations/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(config)
        .expect(200);

      expect(response.body.validation.isValid).toBe(false);
      expect(response.body.validation.errors).toContain('Invalid webhook URL format');
    });

    it('should return error for unsupported integration type', async () => {
      const config = {
        type: 'unsupported_type',
        config: {}
      };

      const response = await request(app)
        .post('/api/integrations/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(config)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Unsupported integration type');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle authentication errors', async () => {
      const response = await request(app)
        .post('/api/integrations')
        .send({})
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No token');
    });

    it('should handle invalid ObjectId format', async () => {
      const response = await request(app)
        .get('/api/integrations/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle malformed request data', async () => {
      const response = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle very large integration configurations', async () => {
      const largeConfig = {
        formId: testForm._id,
        type: 'webhook',
        name: 'Large Config Integration',
        config: {
          webhook: {
            url: 'https://api.example.com/webhook',
            method: 'POST',
            headers: {
              // Large number of headers
              ...Array.from({ length: 100 }, (_, i) => [`header${i}`, `value${i}`])
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
            }
          }
        },
        triggerEvents: ['form_submitted']
      };

      const response = await request(app)
        .post('/api/integrations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeConfig)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle concurrent integration creation requests', async () => {
      const integrationData = {
        formId: testForm._id,
        type: 'webhook',
        name: 'Concurrent Integration',
        config: {
          webhook: {
            url: 'https://api.example.com/webhook',
            method: 'POST'
          }
        },
        triggerEvents: ['form_submitted']
      };

      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/integrations')
          .set('Authorization', `Bearer ${authToken}`)
          .send(integrationData)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all integrations were created
      const integrations = await Integration.find({
        userId: testUser._id,
        name: 'Concurrent Integration'
      });
      expect(integrations).toHaveLength(3);
    });
  });
});