import mongoose from 'mongoose';
import Form from '../../models/Form';
import User from '../../models/User';
import { ConditionalLogicService } from '../../services/ConditionalLogicService';
import { TestUtils } from '../setup';
import { IFormField, FormFieldType } from '../../types';

describe('ConditionalLogicService', () => {
  let testUser: any;
  let testForm: any;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Form.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    testUser = await User.create(userData);

    // Create test form with multiple fields
    const formData = TestUtils.createTestForm(testUser._id.toString());
    formData.fields = [
      {
        id: 'field1',
        type: 'dropdown',
        label: 'How did you hear about us?',
        placeholder: '',
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
        id: 'field2',
        type: 'text',
        label: 'Which social media platform?',
        placeholder: 'e.g., Facebook, Instagram, Twitter',
        required: true,
        order: 1,
        options: [],
        validation: {},
        conditional: {
          show: {
            enabled: true,
            operator: 'AND',
            conditions: [{
              fieldId: 'field1',
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
        id: 'field3',
        type: 'number',
        label: 'How many years of experience?',
        placeholder: 'Enter number',
        required: false,
        order: 2,
        options: [],
        validation: { min: 0, max: 50 },
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'field4',
        type: 'text',
        label: 'Expert level details',
        placeholder: 'Describe your expertise',
        required: false,
        order: 3,
        options: [],
        validation: {},
        conditional: {
          show: {
            enabled: true,
            operator: 'AND',
            conditions: [{
              fieldId: 'field3',
              operator: 'greater_than',
              value: '10'
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
        id: 'field5',
        type: 'checkbox',
        label: 'Skills',
        placeholder: '',
        required: false,
        order: 4,
        options: ['JavaScript', 'Python', 'React', 'Node.js'],
        validation: {},
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
    // Clean up after each test
    await User.deleteMany({});
    await Form.deleteMany({});
  });

  describe('evaluateConditions', () => {
    it('should show field when equals condition is met', async () => {
      const responses = new Map([
        ['field1', 'Social Media']
      ]);

      const result = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field2',
        responses
      );

      expect(result.shouldShow).toBe(true);
      expect(result.shouldSkip).toBe(false);
      expect(result.evaluationDetails).toBeDefined();
      expect(result.evaluationDetails.showConditions.met).toBe(true);
      expect(result.evaluationDetails.showConditions.conditions).toHaveLength(1);
      expect(result.evaluationDetails.showConditions.conditions[0].result).toBe(true);
    });

    it('should hide field when equals condition is not met', async () => {
      const responses = new Map([
        ['field1', 'Google Search']
      ]);

      const result = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field2',
        responses
      );

      expect(result.shouldShow).toBe(false);
      expect(result.shouldSkip).toBe(false);
      expect(result.evaluationDetails.showConditions.met).toBe(false);
      expect(result.evaluationDetails.showConditions.conditions[0].result).toBe(false);
    });

    it('should show field when greater_than condition is met', async () => {
      const responses = new Map([
        ['field3', '15']
      ]);

      const result = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field4',
        responses
      );

      expect(result.shouldShow).toBe(true);
      expect(result.evaluationDetails.showConditions.met).toBe(true);
      expect(result.evaluationDetails.showConditions.conditions[0].result).toBe(true);
    });

    it('should hide field when greater_than condition is not met', async () => {
      const responses = new Map([
        ['field3', '5']
      ]);

      const result = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field4',
        responses
      );

      expect(result.shouldShow).toBe(false);
      expect(result.evaluationDetails.showConditions.met).toBe(false);
      expect(result.evaluationDetails.showConditions.conditions[0].result).toBe(false);
    });

    it('should return true for fields without conditional logic', async () => {
      const responses = new Map();

      const result = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field1', // No conditional logic
        responses
      );

      expect(result.shouldShow).toBe(true);
      expect(result.shouldSkip).toBe(false);
      expect(result.evaluationDetails.showConditions.enabled).toBe(false);
    });

    it('should handle missing field responses', async () => {
      const responses = new Map(); // No responses

      const result = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field2',
        responses
      );

      expect(result.shouldShow).toBe(false);
      expect(result.evaluationDetails.showConditions.conditions[0].result).toBe(false);
    });

    it('should throw error for non-existent form', async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId().toString();
      const responses = new Map();

      await expect(
        ConditionalLogicService.evaluateConditions(nonExistentFormId, 'field1', responses)
      ).rejects.toThrow('Form not found');
    });

    it('should throw error for non-existent field', async () => {
      const responses = new Map();

      await expect(
        ConditionalLogicService.evaluateConditions(
          testForm._id.toString(),
          'non-existent-field',
          responses
        )
      ).rejects.toThrow('Field not found');
    });
  });

  describe('evaluateComplexConditions', () => {
    beforeEach(async () => {
      // Add complex conditional field
      testForm.fields.push({
        id: 'field6',
        type: 'text',
        label: 'Complex conditional field',
        placeholder: '',
        required: false,
        order: 5,
        options: [],
        validation: {},
        conditional: {
          show: {
            enabled: true,
            operator: 'OR',
            conditions: [
              {
                fieldId: 'field1',
                operator: 'equals',
                value: 'Social Media'
              },
              {
                fieldId: 'field3',
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
    });

    it('should handle OR operator with first condition true', async () => {
      const responses = new Map([
        ['field1', 'Social Media'],
        ['field3', '2']
      ]);

      const result = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field6',
        responses
      );

      expect(result.shouldShow).toBe(true);
      expect(result.evaluationDetails.showConditions.met).toBe(true);
      expect(result.evaluationDetails.showConditions.operator).toBe('OR');
    });

    it('should handle OR operator with second condition true', async () => {
      const responses = new Map([
        ['field1', 'Google Search'],
        ['field3', '8']
      ]);

      const result = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field6',
        responses
      );

      expect(result.shouldShow).toBe(true);
      expect(result.evaluationDetails.showConditions.met).toBe(true);
    });

    it('should handle OR operator with both conditions false', async () => {
      const responses = new Map([
        ['field1', 'Google Search'],
        ['field3', '2']
      ]);

      const result = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field6',
        responses
      );

      expect(result.shouldShow).toBe(false);
      expect(result.evaluationDetails.showConditions.met).toBe(false);
    });
  });

  describe('evaluateFieldCondition', () => {
    it('should evaluate equals operator correctly', () => {
      const condition = {
        fieldId: 'field1',
        operator: 'equals' as const,
        value: 'Social Media'
      };

      const resultTrue = ConditionalLogicService.evaluateFieldCondition(condition, 'Social Media');
      const resultFalse = ConditionalLogicService.evaluateFieldCondition(condition, 'Google Search');

      expect(resultTrue).toBe(true);
      expect(resultFalse).toBe(false);
    });

    it('should evaluate not_equals operator correctly', () => {
      const condition = {
        fieldId: 'field1',
        operator: 'not_equals' as const,
        value: 'Social Media'
      };

      const resultTrue = ConditionalLogicService.evaluateFieldCondition(condition, 'Google Search');
      const resultFalse = ConditionalLogicService.evaluateFieldCondition(condition, 'Social Media');

      expect(resultTrue).toBe(true);
      expect(resultFalse).toBe(false);
    });

    it('should evaluate contains operator correctly', () => {
      const condition = {
        fieldId: 'field1',
        operator: 'contains' as const,
        value: 'Search'
      };

      const resultTrue = ConditionalLogicService.evaluateFieldCondition(condition, 'Google Search');
      const resultFalse = ConditionalLogicService.evaluateFieldCondition(condition, 'Social Media');

      expect(resultTrue).toBe(true);
      expect(resultFalse).toBe(false);
    });

    it('should evaluate greater_than operator correctly', () => {
      const condition = {
        fieldId: 'field3',
        operator: 'greater_than' as const,
        value: '5'
      };

      const resultTrue = ConditionalLogicService.evaluateFieldCondition(condition, '10');
      const resultFalse = ConditionalLogicService.evaluateFieldCondition(condition, '3');

      expect(resultTrue).toBe(true);
      expect(resultFalse).toBe(false);
    });

    it('should evaluate less_than operator correctly', () => {
      const condition = {
        fieldId: 'field3',
        operator: 'less_than' as const,
        value: '10'
      };

      const resultTrue = ConditionalLogicService.evaluateFieldCondition(condition, '5');
      const resultFalse = ConditionalLogicService.evaluateFieldCondition(condition, '15');

      expect(resultTrue).toBe(true);
      expect(resultFalse).toBe(false);
    });

    it('should evaluate is_empty operator correctly', () => {
      const condition = {
        fieldId: 'field1',
        operator: 'is_empty' as const,
        value: ''
      };

      const resultTrue1 = ConditionalLogicService.evaluateFieldCondition(condition, '');
      const resultTrue2 = ConditionalLogicService.evaluateFieldCondition(condition, null);
      const resultTrue3 = ConditionalLogicService.evaluateFieldCondition(condition, undefined);
      const resultFalse = ConditionalLogicService.evaluateFieldCondition(condition, 'Not empty');

      expect(resultTrue1).toBe(true);
      expect(resultTrue2).toBe(true);
      expect(resultTrue3).toBe(true);
      expect(resultFalse).toBe(false);
    });

    it('should evaluate is_not_empty operator correctly', () => {
      const condition = {
        fieldId: 'field1',
        operator: 'is_not_empty' as const,
        value: ''
      };

      const resultTrue = ConditionalLogicService.evaluateFieldCondition(condition, 'Not empty');
      const resultFalse1 = ConditionalLogicService.evaluateFieldCondition(condition, '');
      const resultFalse2 = ConditionalLogicService.evaluateFieldCondition(condition, null);

      expect(resultTrue).toBe(true);
      expect(resultFalse1).toBe(false);
      expect(resultFalse2).toBe(false);
    });

    it('should handle array values for checkbox fields', () => {
      const condition = {
        fieldId: 'field5',
        operator: 'contains' as const,
        value: 'JavaScript'
      };

      const resultTrue = ConditionalLogicService.evaluateFieldCondition(condition, ['JavaScript', 'Python']);
      const resultFalse = ConditionalLogicService.evaluateFieldCondition(condition, ['Python', 'React']);

      expect(resultTrue).toBe(true);
      expect(resultFalse).toBe(false);
    });

    it('should handle case-insensitive comparisons', () => {
      const condition = {
        fieldId: 'field1',
        operator: 'equals' as const,
        value: 'social media'
      };

      const result = ConditionalLogicService.evaluateFieldCondition(condition, 'Social Media');
      expect(result).toBe(true);
    });
  });

  describe('getVisibleFields', () => {
    it('should return all visible fields based on responses', async () => {
      const responses = new Map([
        ['field1', 'Social Media'],
        ['field3', '15']
      ]);

      const visibleFields = await ConditionalLogicService.getVisibleFields(
        testForm._id.toString(),
        responses
      );

      expect(visibleFields).toHaveLength(5); // field1, field2, field3, field4, field5
      expect(visibleFields.map(f => f.id)).toContain('field1');
      expect(visibleFields.map(f => f.id)).toContain('field2'); // Shown because field1 = 'Social Media'
      expect(visibleFields.map(f => f.id)).toContain('field3');
      expect(visibleFields.map(f => f.id)).toContain('field4'); // Shown because field3 > 10
      expect(visibleFields.map(f => f.id)).toContain('field5');
    });

    it('should hide conditional fields when conditions are not met', async () => {
      const responses = new Map([
        ['field1', 'Google Search'],
        ['field3', '5']
      ]);

      const visibleFields = await ConditionalLogicService.getVisibleFields(
        testForm._id.toString(),
        responses
      );

      expect(visibleFields).toHaveLength(3); // field1, field3, field5
      expect(visibleFields.map(f => f.id)).not.toContain('field2');
      expect(visibleFields.map(f => f.id)).not.toContain('field4');
    });

    it('should maintain field order when filtering', async () => {
      const responses = new Map([
        ['field1', 'Social Media']
      ]);

      const visibleFields = await ConditionalLogicService.getVisibleFields(
        testForm._id.toString(),
        responses
      );

      // Check that order is maintained
      const orders = visibleFields.map(f => f.order);
      expect(orders).toEqual(orders.sort((a, b) => a - b));
    });
  });

  describe('validateConditionalLogic', () => {
    it('should validate simple conditional logic', () => {
      const logic = {
        show: {
          enabled: true,
          operator: 'AND' as const,
          conditions: [{
            fieldId: 'field1',
            operator: 'equals' as const,
            value: 'test'
          }]
        },
        skip: { enabled: false, conditions: [] }
      };

      const result = ConditionalLogicService.validateConditionalLogic(logic, testForm.fields);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect circular references', () => {
      const logic = {
        show: {
          enabled: true,
          operator: 'AND' as const,
          conditions: [{
            fieldId: 'field2', // field2 referencing itself
            operator: 'equals' as const,
            value: 'test'
          }]
        },
        skip: { enabled: false, conditions: [] }
      };

      const field2 = testForm.fields.find((f: any) => f.id === 'field2');
      const result = ConditionalLogicService.validateConditionalLogic(logic, testForm.fields, field2.id);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Circular reference detected: field cannot reference itself');
    });

    it('should detect invalid field references', () => {
      const logic = {
        show: {
          enabled: true,
          operator: 'AND' as const,
          conditions: [{
            fieldId: 'non-existent-field',
            operator: 'equals' as const,
            value: 'test'
          }]
        },
        skip: { enabled: false, conditions: [] }
      };

      const result = ConditionalLogicService.validateConditionalLogic(logic, testForm.fields);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Referenced field "non-existent-field" does not exist');
    });

    it('should validate complex nested conditions', () => {
      const logic = {
        show: {
          enabled: true,
          operator: 'OR' as const,
          conditions: [
            {
              fieldId: 'field1',
              operator: 'equals' as const,
              value: 'Social Media'
            },
            {
              fieldId: 'field3',
              operator: 'greater_than' as const,
              value: '5'
            }
          ]
        },
        skip: {
          enabled: true,
          operator: 'AND' as const,
          conditions: [{
            fieldId: 'field1',
            operator: 'equals' as const,
            value: 'Skip this'
          }]
        }
      };

      const result = ConditionalLogicService.validateConditionalLogic(logic, testForm.fields);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate empty conditions array', () => {
      const logic = {
        show: {
          enabled: true,
          operator: 'AND' as const,
          conditions: []
        },
        skip: { enabled: false, conditions: [] }
      };

      const result = ConditionalLogicService.validateConditionalLogic(logic, testForm.fields);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one condition is required when conditional logic is enabled');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed field responses', async () => {
      const responses = new Map([
        ['field1', { malformed: 'object' }] // Should be string
      ]);

      const result = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field2',
        responses
      );

      expect(result.shouldShow).toBe(false);
    });

    it('should handle undefined and null responses', async () => {
      const responses = new Map([
        ['field1', null],
        ['field3', undefined]
      ]);

      const result1 = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field2',
        responses
      );

      const result2 = await ConditionalLogicService.evaluateConditions(
        testForm._id.toString(),
        'field4',
        responses
      );

      expect(result1.shouldShow).toBe(false);
      expect(result2.shouldShow).toBe(false);
    });

    it('should handle invalid ObjectId format', async () => {
      const responses = new Map();

      await expect(
        ConditionalLogicService.evaluateConditions('invalid-id', 'field1', responses)
      ).rejects.toThrow();
    });

    it('should handle database connection errors gracefully', async () => {
      // Temporarily break the form to simulate DB error
      await Form.deleteMany({});

      const responses = new Map();

      await expect(
        ConditionalLogicService.evaluateConditions(testForm._id.toString(), 'field1', responses)
      ).rejects.toThrow('Form not found');
    });
  });
});