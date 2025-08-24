import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import Form from '../../models/Form';
import FormResponse from '../../models/FormResponse';
import { TestUtils } from '../setup';

describe('Responses API Integration Tests', () => {
  let testUser: any;
  let testForm: any;
  let testResponses: any[];
  let authToken: string;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Form.deleteMany({});
    await FormResponse.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    testUser = await User.create(userData);
    authToken = TestUtils.generateToken(testUser._id.toString(), testUser.email);

    // Create test form
    const formData = TestUtils.createTestForm(testUser._id.toString());
    testForm = await Form.create(formData);

    // Create test responses
    testResponses = await FormResponse.create([
      {
        formId: testForm._id,
        responses: [
          { fieldId: 'field1', value: 'John Doe', fieldType: 'text' },
          { fieldId: 'field2', value: 'john@example.com', fieldType: 'email' }
        ],
        submittedAt: new Date('2024-01-15'),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Chrome)',
        metadata: {
          submissionTime: 1200,
          deviceInfo: { type: 'desktop', browser: 'Chrome', os: 'Windows' }
        },
        isPartial: false,
        completedAt: new Date('2024-01-15')
      },
      {
        formId: testForm._id,
        responses: [
          { fieldId: 'field1', value: 'Jane Smith', fieldType: 'text' },
          { fieldId: 'field2', value: 'jane@example.com', fieldType: 'email' }
        ],
        submittedAt: new Date('2024-01-16'),
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0 (Safari)',
        metadata: {
          submissionTime: 800,
          deviceInfo: { type: 'mobile', browser: 'Safari', os: 'iOS' }
        },
        isPartial: false,
        completedAt: new Date('2024-01-16')
      }
    ]);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Form.deleteMany({});
    await FormResponse.deleteMany({});
  });

  describe('GET /api/responses/forms/:formId', () => {
    it('should get responses for a specific form with pagination', async () => {
      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('responses');
      expect(response.body.data.responses).toHaveLength(2);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('total', 2);
    });

    it('should filter responses by date range', async () => {
      const startDate = '2024-01-15';
      const endDate = '2024-01-15';

      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.responses).toHaveLength(1);
      expect(response.body.data.responses[0].responses[0].value).toBe('John Doe');
    });

    it('should search responses by content', async () => {
      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}?search=jane`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.responses).toHaveLength(1);
      expect(response.body.data.responses[0].responses[0].value).toBe('Jane Smith');
    });

    it('should paginate responses correctly', async () => {
      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}?page=1&limit=1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.responses).toHaveLength(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.pages).toBe(2);
    });

    it('should return error for non-existent form', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/responses/forms/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Form not found');
    });

    it('should return error for form belonging to other user', async () => {
      // Create another user and form
      const otherUser = await User.create({
        ...TestUtils.createTestUser(),
        email: 'other@test.com'
      });
      const otherForm = await Form.create({
        ...TestUtils.createTestForm(otherUser._id.toString()),
        publicUrl: 'other-form-' + Date.now()
      });

      const response = await request(app)
        .get(`/api/responses/forms/${otherForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return empty array for form with no responses', async () => {
      const emptyForm = await Form.create({
        ...TestUtils.createTestForm(testUser._id.toString()),
        publicUrl: 'empty-form-' + Date.now()
      });

      const response = await request(app)
        .get(`/api/responses/forms/${emptyForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.responses).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });
  });

  describe('GET /api/responses/forms/:formId/export', () => {
    it('should export responses as CSV', async () => {
      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}/export?format=csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('John Doe');
      expect(response.text).toContain('Jane Smith');
    });

    it('should export responses as JSON', async () => {
      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}/export?format=json`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('responses');
      expect(response.body.data.responses).toHaveLength(2);
    });

    it('should filter exported responses by date range', async () => {
      const startDate = '2024-01-16';
      const endDate = '2024-01-16';

      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}/export?format=json&startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.responses).toHaveLength(1);
      expect(response.body.data.responses[0]).toHaveProperty('field1', 'Jane Smith');
    });

    it('should return error when no responses to export', async () => {
      const emptyForm = await Form.create({
        ...TestUtils.createTestForm(testUser._id.toString()),
        publicUrl: 'empty-form-' + Date.now()
      });

      const response = await request(app)
        .get(`/api/responses/forms/${emptyForm._id}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No responses found');
    });

    it('should handle large dataset exports', async () => {
      // Create many responses
      const manyResponses = Array(50).fill(null).map((_, index) => ({
        formId: testForm._id,
        responses: [
          { fieldId: 'field1', value: `User ${index}`, fieldType: 'text' },
          { fieldId: 'field2', value: `user${index}@example.com`, fieldType: 'email' }
        ],
        submittedAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        metadata: {},
        isPartial: false,
        completedAt: new Date()
      }));

      await FormResponse.create(manyResponses);

      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}/export?format=json`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.responses.length).toBeGreaterThan(50);
    });
  });

  describe('GET /api/responses/:responseId', () => {
    it('should get single response details', async () => {
      const responseId = testResponses[0]._id;

      const response = await request(app)
        .get(`/api/responses/${responseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.response).toHaveProperty('_id', responseId.toString());
      expect(response.body.response.responses[0]).toHaveProperty('value', 'John Doe');
      expect(response.body.response).toHaveProperty('submittedAt');
      expect(response.body.response).toHaveProperty('metadata');
    });

    it('should return error for non-existent response', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/responses/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Response not found');
    });

    it('should return error for response from other user form', async () => {
      // Create another user and form response
      const otherUser = await User.create({
        ...TestUtils.createTestUser(),
        email: 'other@test.com'
      });
      const otherForm = await Form.create({
        ...TestUtils.createTestForm(otherUser._id.toString()),
        publicUrl: 'other-form-' + Date.now()
      });
      const otherResponse = await FormResponse.create({
        formId: otherForm._id,
        responses: [{ fieldId: 'field1', value: 'Other User Response', fieldType: 'text' }],
        submittedAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        metadata: {},
        isPartial: false,
        completedAt: new Date()
      });

      const response = await request(app)
        .get(`/api/responses/${otherResponse._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('DELETE /api/responses/:responseId', () => {
    it('should delete response successfully', async () => {
      const responseId = testResponses[0]._id;

      const response = await request(app)
        .delete(`/api/responses/${responseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Response deleted successfully');

      // Verify response was deleted
      const deletedResponse = await FormResponse.findById(responseId);
      expect(deletedResponse).toBeNull();

      // Verify form analytics were updated
      const updatedForm = await Form.findById(testForm._id);
      expect(updatedForm!.analytics.totalSubmissions).toBe(0); // Decremented
    });

    it('should return error for non-existent response', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/responses/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should update form submission count after deletion', async () => {
      const initialCount = await FormResponse.countDocuments({ formId: testForm._id });
      expect(initialCount).toBe(2);

      await request(app)
        .delete(`/api/responses/${testResponses[0]._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const finalCount = await FormResponse.countDocuments({ formId: testForm._id });
      expect(finalCount).toBe(1);
    });
  });

  describe('Response Analytics', () => {
    it('should calculate response statistics correctly', async () => {
      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary).toHaveProperty('totalResponses', 2);
      expect(response.body.data.summary).toHaveProperty('avgCompletionTime');
    });

    it('should track device and browser statistics', async () => {
      // The responses have different device types and browsers
      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responses = response.body.data.responses;
      const desktopResponse = responses.find((r: any) => 
        r.metadata.deviceInfo?.type === 'desktop'
      );
      const mobileResponse = responses.find((r: any) => 
        r.metadata.deviceInfo?.type === 'mobile'
      );

      expect(desktopResponse).toBeTruthy();
      expect(mobileResponse).toBeTruthy();
      expect(desktopResponse.metadata.deviceInfo.browser).toBe('Chrome');
      expect(mobileResponse.metadata.deviceInfo.browser).toBe('Safari');
    });
  });

  describe('Response Validation', () => {
    it('should handle responses with missing fields', async () => {
      const incompleteResponse = await FormResponse.create({
        formId: testForm._id,
        responses: [
          // Missing required field
          { fieldId: 'field2', value: 'incomplete@example.com', fieldType: 'email' }
        ],
        submittedAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        metadata: {},
        isPartial: true, // Marked as partial
        completedAt: null
      });

      const response = await request(app)
        .get(`/api/responses/${incompleteResponse._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.response.isPartial).toBe(true);
      expect(response.body.response.completedAt).toBeNull();
    });

    it('should handle responses with extra fields', async () => {
      const responseWithExtraFields = await FormResponse.create({
        formId: testForm._id,
        responses: [
          { fieldId: 'field1', value: 'Test User', fieldType: 'text' },
          { fieldId: 'field2', value: 'test@example.com', fieldType: 'email' },
          { fieldId: 'field3', value: 'Extra field', fieldType: 'text' } // Not in form
        ],
        submittedAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        metadata: {},
        isPartial: false,
        completedAt: new Date()
      });

      const response = await request(app)
        .get(`/api/responses/${responseWithExtraFields._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.response.responses).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid ObjectId format', async () => {
      const response = await request(app)
        .get('/api/responses/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle database errors gracefully', async () => {
      // Test with malformed form ID that might cause DB errors
      const response = await request(app)
        .get('/api/responses/forms/000000000000000000000000') // Valid ObjectId but non-existent
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No token');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large response datasets efficiently', async () => {
      // Create many responses
      const manyResponses = Array(100).fill(null).map((_, index) => ({
        formId: testForm._id,
        responses: [
          { fieldId: 'field1', value: `User ${index}`, fieldType: 'text' },
          { fieldId: 'field2', value: `user${index}@example.com`, fieldType: 'email' }
        ],
        submittedAt: new Date(Date.now() - index * 1000 * 60), // Spread over time
        ipAddress: `192.168.1.${(index % 255) + 1}`,
        userAgent: 'Test Agent',
        metadata: { submissionTime: Math.random() * 2000 },
        isPartial: false,
        completedAt: new Date(Date.now() - index * 1000 * 60 + 30000)
      }));

      await FormResponse.create(manyResponses);

      const startTime = Date.now();
      const response = await request(app)
        .get(`/api/responses/forms/${testForm._id}?limit=50`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const endTime = Date.now();

      expect(response.body.data.responses).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent response requests', async () => {
      const concurrentRequests = Array(5).fill(null).map(() =>
        request(app)
          .get(`/api/responses/forms/${testForm._id}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.responses).toHaveLength(2);
      });
    });
  });
});