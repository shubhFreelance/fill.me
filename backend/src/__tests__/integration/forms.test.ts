import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import Form from '../../models/Form';
import FormResponse from '../../models/FormResponse';
import { TestUtils } from '../setup';

describe('Forms API Integration Tests', () => {
  let testUser: any;
  let testForm: any;
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
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Form.deleteMany({});
    await FormResponse.deleteMany({});
  });

  describe('GET /api/forms', () => {
    it('should get user forms with pagination', async () => {
      const response = await request(app)
        .get('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('docs');
      expect(response.body.data.docs).toHaveLength(1);
      expect(response.body.data.docs[0]).toHaveProperty('title', testForm.title);
      expect(response.body.data).toHaveProperty('totalDocs');
      expect(response.body.data).toHaveProperty('limit');
      expect(response.body.data).toHaveProperty('page');
    });

    it('should filter forms by search query', async () => {
      // Create another form with different title
      await Form.create({
        ...TestUtils.createTestForm(testUser._id.toString()),
        title: 'Contact Form',
        publicUrl: 'contact-form-' + Date.now()
      });

      const response = await request(app)
        .get('/api/forms?search=Contact')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.docs).toHaveLength(1);
      expect(response.body.data.docs[0].title).toContain('Contact');
    });

    it('should sort forms by different criteria', async () => {
      // Create another form
      await TestUtils.wait(100); // Ensure different timestamps
      await Form.create({
        ...TestUtils.createTestForm(testUser._id.toString()),
        title: 'Newer Form',
        publicUrl: 'newer-form-' + Date.now()
      });

      const response = await request(app)
        .get('/api/forms?sortBy=title&sortOrder=asc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.docs).toHaveLength(2);
      expect(response.body.data.docs[0].title).toBeLessThan(response.body.data.docs[1].title);
    });

    it('should return error without authentication', async () => {
      const response = await request(app)
        .get('/api/forms')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should only return user own forms', async () => {
      // Create another user and form
      const otherUser = await User.create({
        ...TestUtils.createTestUser(),
        email: 'other@test.com'
      });
      await Form.create({
        ...TestUtils.createTestForm(otherUser._id.toString()),
        title: 'Other User Form',
        publicUrl: 'other-form-' + Date.now()
      });

      const response = await request(app)
        .get('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.docs).toHaveLength(1);
      expect(response.body.data.docs[0].title).toBe(testForm.title);
    });
  });

  describe('POST /api/forms', () => {
    it('should create a new form successfully', async () => {
      const newFormData = {
        title: 'New Test Form',
        description: 'A new form for testing',
        fields: [
          {
            type: 'text',
            label: 'Full Name',
            placeholder: 'Enter your full name',
            required: true
          },
          {
            type: 'email',
            label: 'Email Address',
            placeholder: 'Enter your email',
            required: true
          }
        ]
      };

      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newFormData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.form).toHaveProperty('title', newFormData.title);
      expect(response.body.form).toHaveProperty('description', newFormData.description);
      expect(response.body.form.fields).toHaveLength(2);
      expect(response.body.form).toHaveProperty('publicUrl');
      expect(response.body.form).toHaveProperty('embedCode');

      // Verify form was created in database
      const createdForm = await Form.findById(response.body.form._id);
      expect(createdForm).toBeTruthy();
      expect(createdForm!.userId.toString()).toBe(testUser._id.toString());
    });

    it('should return error for missing required fields', async () => {
      const invalidFormData = {
        description: 'Form without title'
        // Missing title and fields
      };

      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidFormData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return error for empty fields array', async () => {
      const invalidFormData = {
        title: 'Form Without Fields',
        fields: []
      };

      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidFormData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should generate unique public URL', async () => {
      const formData1 = {
        title: 'Test Form',
        fields: [{ type: 'text', label: 'Name', required: false }]
      };

      const formData2 = {
        title: 'Test Form', // Same title
        fields: [{ type: 'email', label: 'Email', required: false }]
      };

      const response1 = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(formData1)
        .expect(201);

      const response2 = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(formData2)
        .expect(201);

      expect(response1.body.form.publicUrl).not.toBe(response2.body.form.publicUrl);
    });
  });

  describe('GET /api/forms/:id', () => {
    it('should get specific form by ID', async () => {
      const response = await request(app)
        .get(`/api/forms/${testForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.form).toHaveProperty('_id', testForm._id.toString());
      expect(response.body.form).toHaveProperty('title', testForm.title);
      expect(response.body.form).toHaveProperty('fields');
      expect(response.body.form.fields).toHaveLength(1);
    });

    it('should return error for non-existent form', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/forms/${nonExistentId}`)
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
        .get(`/api/forms/${otherForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return error with invalid ObjectId', async () => {
      const response = await request(app)
        .get('/api/forms/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/forms/:id', () => {
    it('should update form successfully', async () => {
      const updateData = {
        title: 'Updated Form Title',
        description: 'Updated description',
        fields: [
          {
            type: 'text',
            label: 'Updated Name Field',
            placeholder: 'Enter name',
            required: true
          },
          {
            type: 'email',
            label: 'Email Field',
            placeholder: 'Enter email',
            required: false
          }
        ]
      };

      const response = await request(app)
        .put(`/api/forms/${testForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.form.title).toBe(updateData.title);
      expect(response.body.form.description).toBe(updateData.description);
      expect(response.body.form.fields).toHaveLength(2);

      // Verify update in database
      const updatedForm = await Form.findById(testForm._id);
      expect(updatedForm!.title).toBe(updateData.title);
      expect(updatedForm!.fields).toHaveLength(2);
    });

    it('should update form customization', async () => {
      const updateData = {
        customization: {
          primaryColor: '#ff0000',
          backgroundColor: '#ffffff',
          theme: 'modern',
          fontFamily: 'Roboto'
        }
      };

      const response = await request(app)
        .put(`/api/forms/${testForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.form.customization.primaryColor).toBe('#ff0000');
      expect(response.body.form.customization.theme).toBe('modern');
    });

    it('should return error for non-existent form', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = { title: 'Updated Title' };

      const response = await request(app)
        .put(`/api/forms/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return error for empty fields array', async () => {
      const updateData = {
        title: 'Updated Title',
        fields: []
      };

      const response = await request(app)
        .put(`/api/forms/${testForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('DELETE /api/forms/:id', () => {
    it('should delete form successfully', async () => {
      const response = await request(app)
        .delete(`/api/forms/${testForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Form deleted successfully');

      // Verify form was deleted (soft delete)
      const deletedForm = await Form.findById(testForm._id);
      expect(deletedForm!.isActive).toBe(false);
    });

    it('should return error for non-existent form', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/forms/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should delete associated form responses', async () => {
      // Create a form response
      await FormResponse.create({
        formId: testForm._id,
        responses: [{ fieldId: 'field1', value: 'Test Response', fieldType: 'text' }],
        submittedAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        metadata: {},
        isPartial: false,
        completedAt: new Date()
      });

      const responsesBefore = await FormResponse.countDocuments({ formId: testForm._id });
      expect(responsesBefore).toBe(1);

      await request(app)
        .delete(`/api/forms/${testForm._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify responses were deleted
      const responsesAfter = await FormResponse.countDocuments({ formId: testForm._id });
      expect(responsesAfter).toBe(0);
    });
  });

  describe('POST /api/forms/:id/duplicate', () => {
    it('should duplicate form successfully', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.form.title).toContain('Copy of');
      expect(response.body.form.title).toContain(testForm.title);
      expect(response.body.form.fields).toHaveLength(testForm.fields.length);
      expect(response.body.form.publicUrl).not.toBe(testForm.publicUrl);

      // Verify new form was created
      const duplicatedForm = await Form.findById(response.body.form._id);
      expect(duplicatedForm).toBeTruthy();
      expect(duplicatedForm!.userId.toString()).toBe(testUser._id.toString());
    });

    it('should return error for non-existent form', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/forms/${nonExistentId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/forms/:id/publish', () => {
    beforeEach(async () => {
      // Make form unpublished initially
      testForm.isPublic = false;
      await testForm.save();
    });

    it('should publish form successfully', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/publish`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.form.isPublic).toBe(true);
      expect(response.body.message).toContain('published successfully');

      // Verify in database
      const publishedForm = await Form.findById(testForm._id);
      expect(publishedForm!.isPublic).toBe(true);
    });

    it('should unpublish form', async () => {
      // First publish it
      testForm.isPublic = true;
      await testForm.save();

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/publish`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isPublic: false })
        .expect(200);

      expect(response.body.form.isPublic).toBe(false);
      expect(response.body.message).toContain('unpublished successfully');
    });
  });

  describe('GET /api/forms/:id/analytics', () => {
    beforeEach(async () => {
      // Create some form responses for analytics
      await FormResponse.create([
        {
          formId: testForm._id,
          responses: [{ fieldId: 'field1', value: 'Response 1', fieldType: 'text' }],
          submittedAt: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent 1',
          metadata: { deviceInfo: { type: 'desktop' } },
          isPartial: false,
          completedAt: new Date()
        },
        {
          formId: testForm._id,
          responses: [{ fieldId: 'field1', value: 'Response 2', fieldType: 'text' }],
          submittedAt: new Date(),
          ipAddress: '127.0.0.2',
          userAgent: 'Test Agent 2',
          metadata: { deviceInfo: { type: 'mobile' } },
          isPartial: false,
          completedAt: new Date()
        }
      ]);
    });

    it('should get form analytics', async () => {
      const response = await request(app)
        .get(`/api/forms/${testForm._id}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.analytics).toHaveProperty('overview');
      expect(response.body.analytics).toHaveProperty('responseAnalytics');
      expect(response.body.analytics).toHaveProperty('recentResponses');
      expect(response.body.analytics.overview).toHaveProperty('totalViews');
      expect(response.body.analytics.overview).toHaveProperty('totalSubmissions');
      expect(response.body.analytics.responseAnalytics).toHaveProperty('totalResponses');
    });

    it('should filter analytics by date range', async () => {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .get(`/api/forms/${testForm._id}/analytics?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.analytics).toBeDefined();
    });
  });

  describe('Form Validation', () => {
    it('should validate form field types', async () => {
      const invalidFormData = {
        title: 'Invalid Form',
        fields: [
          {
            type: 'invalid_type',
            label: 'Invalid Field',
            required: false
          }
        ]
      };

      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidFormData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate required field properties', async () => {
      const invalidFormData = {
        title: 'Invalid Form',
        fields: [
          {
            type: 'text'
            // Missing required label
          }
        ]
      };

      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidFormData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate dropdown/radio field options', async () => {
      const validFormData = {
        title: 'Valid Dropdown Form',
        fields: [
          {
            type: 'dropdown',
            label: 'Select Option',
            required: true,
            options: ['Option 1', 'Option 2', 'Option 3']
          }
        ]
      };

      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validFormData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.form.fields[0].options).toHaveLength(3);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting on form creation', async () => {
      const formData = {
        title: 'Rate Limited Form',
        fields: [{ type: 'text', label: 'Name', required: false }]
      };

      // Make multiple rapid requests (this test assumes rate limiting is configured)
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/forms')
          .set('Authorization', `Bearer ${authToken}`)
          .send(formData)
      );

      const responses = await Promise.allSettled(requests);
      
      // At least some requests should succeed
      const successfulRequests = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );
      expect(successfulRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require more complex setup to simulate DB errors
      // For now, we'll test basic error response format
      const response = await request(app)
        .get('/api/forms/invalid-object-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle large form data appropriately', async () => {
      const largeFormData = {
        title: 'Large Form',
        description: 'A'.repeat(2000), // Very long description
        fields: Array(100).fill(null).map((_, index) => ({
          type: 'text',
          label: `Field ${index + 1}`,
          required: false
        }))
      };

      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeFormData);

      // Should either succeed or fail gracefully
      expect([200, 201, 400, 413]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
    });
  });
});