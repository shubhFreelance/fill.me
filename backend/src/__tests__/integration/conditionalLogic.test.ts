import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import Form from '../../models/Form';
import { TestUtils } from '../setup';

describe('Conditional Logic API Integration Tests', () => {
  let testUser: any;
  let testForm: any;
  let authToken: string;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Form.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    testUser = await User.create(userData);
    authToken = TestUtils.generateToken(testUser._id.toString(), testUser.email);

    // Create test form with conditional fields
    const formData = TestUtils.createTestForm(testUser._id.toString());
    formData.fields = [
      {
        id: 'source',
        type: 'dropdown',
        label: 'How did you hear about us?',
        required: true,
        order: 0,
        options: ['Social Media', 'Google Search', 'Friend', 'Advertisement'],
        validation: {},
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'social_platform',
        type: 'text',
        label: 'Which social media platform?',
        required: true,
        order: 1,
        options: [],
        validation: {},
        conditional: {
          show: {
            enabled: true,
            operator: 'AND',
            conditions: [{
              fieldId: 'source',
              operator: 'equals',
              value: 'Social Media'
            }]
          },
          skip: { enabled: false, conditions: [] }
        },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'experience',
        type: 'number',
        label: 'Years of experience',
        required: false,
        order: 2,
        options: [],
        validation: { min: 0, max: 50 },
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      }
    ];
    testForm = await Form.create(formData);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Form.deleteMany({});
  });

  describe('POST /api/forms/:formId/conditional-logic/evaluate', () => {
    it('should evaluate conditional logic for visible fields', async () => {
      const responses = {
        source: 'Social Media',
        experience: '5'
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/conditional-logic/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.evaluation).toBeDefined();
      expect(response.body.evaluation.visibleFields).toHaveLength(3);
      expect(response.body.evaluation.visibleFields.map((f: any) => f.id))
        .toEqual(['source', 'social_platform', 'experience']);

      expect(response.body.evaluation.fieldEvaluations).toHaveProperty('social_platform');
      expect(response.body.evaluation.fieldEvaluations.social_platform.shouldShow).toBe(true);
    });

    it('should hide conditional fields when conditions are not met', async () => {
      const responses = {
        source: 'Google Search',
        experience: '3'
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/conditional-logic/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses })
        .expect(200);

      expect(response.body.evaluation.visibleFields).toHaveLength(2);
      expect(response.body.evaluation.visibleFields.map((f: any) => f.id))
        .toEqual(['source', 'experience']);

      expect(response.body.evaluation.fieldEvaluations.social_platform.shouldShow).toBe(false);
    });

    it('should handle empty responses', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/conditional-logic/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses: {} })
        .expect(200);

      expect(response.body.evaluation.visibleFields).toHaveLength(2);
      expect(response.body.evaluation.visibleFields.map((f: any) => f.id))
        .toEqual(['source', 'experience']);
    });

    it('should return error for non-existent form', async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/forms/${nonExistentFormId}/conditional-logic/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses: {} })
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

      const response = await request(app)
        .post(`/api/forms/${otherForm._id}/conditional-logic/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses: {} })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/conditional-logic/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Missing responses
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Responses are required');
    });
  });

  describe('POST /api/forms/:formId/fields/:fieldId/conditional-logic', () => {
    it('should set conditional logic for a field', async () => {
      const conditionalLogic = {
        show: {
          enabled: true,
          operator: 'AND',
          conditions: [{
            fieldId: 'source',
            operator: 'equals',
            value: 'Friend'
          }]
        },
        skip: {
          enabled: false,
          conditions: []
        }
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/fields/experience/conditional-logic`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conditionalLogic })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.field).toBeDefined();
      expect(response.body.field.conditional.show.enabled).toBe(true);
      expect(response.body.field.conditional.show.conditions).toHaveLength(1);

      // Verify in database
      const updatedForm = await Form.findById(testForm._id);
      const experienceField = updatedForm!.fields.find(f => f.id === 'experience');
      expect(experienceField!.conditional.show.enabled).toBe(true);
    });

    it('should validate conditional logic configuration', async () => {
      const invalidLogic = {
        show: {
          enabled: true,
          operator: 'AND',
          conditions: [] // Empty conditions array
        }
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/fields/experience/conditional-logic`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conditionalLogic: invalidLogic })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('At least one condition is required');
    });

    it('should detect circular references', async () => {
      const circularLogic = {
        show: {
          enabled: true,
          operator: 'AND',
          conditions: [{
            fieldId: 'social_platform', // self-reference
            operator: 'equals',
            value: 'test'
          }]
        }
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/fields/social_platform/conditional-logic`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conditionalLogic: circularLogic })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Circular reference detected');
    });

    it('should validate referenced field exists', async () => {
      const invalidLogic = {
        show: {
          enabled: true,
          operator: 'AND',
          conditions: [{
            fieldId: 'non-existent-field',
            operator: 'equals',
            value: 'test'
          }]
        }
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/fields/experience/conditional-logic`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conditionalLogic: invalidLogic })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Referenced field "non-existent-field" does not exist');
    });

    it('should return error for non-existent field', async () => {
      const conditionalLogic = {
        show: {
          enabled: true,
          operator: 'AND',
          conditions: [{
            fieldId: 'source',
            operator: 'equals',
            value: 'test'
          }]
        }
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/fields/non-existent-field/conditional-logic`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ conditionalLogic })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Field not found');
    });
  });

  describe('DELETE /api/forms/:formId/fields/:fieldId/conditional-logic', () => {
    beforeEach(async () => {
      // Add conditional logic to a field
      const form = await Form.findById(testForm._id);
      const experienceField = form!.fields.find(f => f.id === 'experience');
      experienceField!.conditional = {
        show: {
          enabled: true,
          operator: 'AND',
          conditions: [{
            fieldId: 'source',
            operator: 'equals',
            value: 'Friend'
          }]
        },
        skip: { enabled: false, conditions: [] }
      };
      await form!.save();
    });

    it('should remove conditional logic from a field', async () => {
      const response = await request(app)
        .delete(`/api/forms/${testForm._id}/fields/experience/conditional-logic`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.field.conditional.show.enabled).toBe(false);
      expect(response.body.field.conditional.show.conditions).toHaveLength(0);

      // Verify in database
      const updatedForm = await Form.findById(testForm._id);
      const experienceField = updatedForm!.fields.find(f => f.id === 'experience');
      expect(experienceField!.conditional.show.enabled).toBe(false);
    });

    it('should return error for field without conditional logic', async () => {
      const response = await request(app)
        .delete(`/api/forms/${testForm._id}/fields/source/conditional-logic`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Field does not have conditional logic enabled');
    });
  });

  describe('GET /api/forms/:formId/conditional-logic/summary', () => {
    it('should get conditional logic summary for form', async () => {
      const response = await request(app)
        .get(`/api/forms/${testForm._id}/conditional-logic/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalFields).toBe(3);
      expect(response.body.summary.fieldsWithLogic).toBe(1);
      expect(response.body.summary.totalConditions).toBe(1);
      expect(response.body.summary.fieldDetails).toHaveLength(3);

      const socialPlatformField = response.body.summary.fieldDetails.find(
        (f: any) => f.fieldId === 'social_platform'
      );
      expect(socialPlatformField.hasConditionalLogic).toBe(true);
      expect(socialPlatformField.conditionsCount).toBe(1);
    });

    it('should include dependency graph', async () => {
      const response = await request(app)
        .get(`/api/forms/${testForm._id}/conditional-logic/summary?includeDependencies=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.summary).toHaveProperty('dependencyGraph');
      expect(response.body.summary.dependencyGraph).toHaveProperty('social_platform');
      expect(response.body.summary.dependencyGraph.social_platform).toEqual(['source']);
    });

    it('should handle form without conditional logic', async () => {
      const simpleForm = await Form.create({
        ...TestUtils.createTestForm(testUser._id.toString()),
        publicUrl: 'simple-form-' + Date.now(),
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
            required: true,
            order: 0,
            options: [],
            validation: {},
            conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
            answerRecall: { enabled: false },
            calculation: { enabled: false, dependencies: [], displayType: 'number' },
            prefill: { enabled: false },
            properties: {}
          }
        ]
      });

      const response = await request(app)
        .get(`/api/forms/${simpleForm._id}/conditional-logic/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.summary.totalFields).toBe(1);
      expect(response.body.summary.fieldsWithLogic).toBe(0);
      expect(response.body.summary.totalConditions).toBe(0);
    });
  });

  describe('POST /api/forms/:formId/conditional-logic/test', () => {
    it('should test conditional logic with sample data', async () => {
      const testData = {
        scenarios: [
          {
            name: 'Social Media Selected',
            responses: { source: 'Social Media' }
          },
          {
            name: 'Google Search Selected',
            responses: { source: 'Google Search' }
          },
          {
            name: 'No Selection',
            responses: {}
          }
        ]
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/conditional-logic/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.testResults).toHaveLength(3);

      const socialMediaScenario = response.body.testResults.find(
        (r: any) => r.scenarioName === 'Social Media Selected'
      );
      expect(socialMediaScenario.visibleFields).toHaveLength(3);
      expect(socialMediaScenario.visibleFields.map((f: any) => f.id))
        .toContain('social_platform');

      const googleSearchScenario = response.body.testResults.find(
        (r: any) => r.scenarioName === 'Google Search Selected'
      );
      expect(googleSearchScenario.visibleFields).toHaveLength(2);
      expect(googleSearchScenario.visibleFields.map((f: any) => f.id))
        .not.toContain('social_platform');
    });

    it('should generate default test scenarios if none provided', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/conditional-logic/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.testResults).toBeDefined();
      expect(response.body.testResults.length).toBeGreaterThan(0);
    });

    it('should validate test scenario data', async () => {
      const invalidTestData = {
        scenarios: [
          {
            // Missing name
            responses: { source: 'Social Media' }
          }
        ]
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/conditional-logic/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTestData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Scenario name is required');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle authentication errors', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/conditional-logic/evaluate`)
        .send({ responses: {} })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No token');
    });

    it('should handle invalid ObjectId format', async () => {
      const response = await request(app)
        .post('/api/forms/invalid-id/conditional-logic/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses: {} })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle malformed request data', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/conditional-logic/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle very complex conditional logic', async () => {
      // Add a field with multiple complex conditions
      testForm.fields.push({
        id: 'complex_field',
        type: 'text',
        label: 'Complex Field',
        required: false,
        order: 3,
        options: [],
        validation: {},
        conditional: {
          show: {
            enabled: true,
            operator: 'OR',
            conditions: [
              {
                fieldId: 'source',
                operator: 'equals',
                value: 'Social Media'
              },
              {
                fieldId: 'experience',
                operator: 'greater_than',
                value: '5'
              }
            ]
          },
          skip: { enabled: false, conditions: [] }
        },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      });
      await testForm.save();

      const responses = {
        source: 'Google Search',
        experience: '8'
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/conditional-logic/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses })
        .expect(200);

      expect(response.body.evaluation.visibleFields.map((f: any) => f.id))
        .toContain('complex_field');
    });

    it('should handle concurrent evaluation requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post(`/api/forms/${testForm._id}/conditional-logic/evaluate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ responses: { source: 'Social Media' } })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.evaluation.visibleFields).toHaveLength(3);
      });
    });
  });
});