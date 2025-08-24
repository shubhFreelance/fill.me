import mongoose from 'mongoose';
import Form from '../../models/Form';
import User from '../../models/User';
import { FormBuilderService } from '../../services/FormBuilderService';
import { TestUtils } from '../setup';
import { IForm, IFormField, FormFieldType } from '../../types';

describe('FormBuilderService', () => {
  let testUser: any;
  let testForm: any;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Form.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    testUser = await User.create(userData);

    // Create test form
    const formData = TestUtils.createTestForm(testUser._id.toString());
    testForm = await Form.create(formData);
  });

  afterEach(async () => {
    // Clean up after each test
    await User.deleteMany({});
    await Form.deleteMany({});
  });

  describe('getFormBuilderData', () => {
    it('should return enhanced form data for builder', async () => {
      const result = await FormBuilderService.getFormBuilderData(
        testForm._id.toString(),
        testUser._id.toString()
      );

      expect(result).toBeDefined();
      expect(result.formId).toBe(testForm._id.toString());
      expect(result.title).toBe(testForm.title);
      expect(result.description).toBe(testForm.description);
      expect(result.fields).toHaveLength(1);
      expect(result.fields[0]).toHaveProperty('builderMetadata');
      expect(result.fields[0].builderMetadata).toHaveProperty('canDelete');
      expect(result.fields[0].builderMetadata).toHaveProperty('canReorder');
      expect(result.fields[0].builderMetadata).toHaveProperty('canAddLogic');
      expect(result.conditionalLogic).toBeDefined();
      expect(result.fieldDependencies).toBeDefined();
      expect(result.availableFieldTypes).toBeDefined();
      expect(result.settings).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalFields).toBe(1);
    });

    it('should throw error when form not found', async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        FormBuilderService.getFormBuilderData(nonExistentFormId, testUser._id.toString())
      ).rejects.toThrow('Form not found or access denied');
    });

    it('should throw error when user does not have access', async () => {
      const otherUser = await User.create({
        ...TestUtils.createTestUser(),
        email: 'other@test.com'
      });

      await expect(
        FormBuilderService.getFormBuilderData(testForm._id.toString(), otherUser._id.toString())
      ).rejects.toThrow('Form not found or access denied');
    });

    it('should calculate metadata correctly', async () => {
      // Add conditional field to test form
      testForm.fields.push({
        id: 'field2',
        type: 'text',
        label: 'Conditional Field',
        required: true,
        order: 1,
        conditional: {
          show: {
            enabled: true,
            conditions: [{
              fieldId: 'field1',
              operator: 'equals',
              value: 'test'
            }]
          },
          skip: { enabled: false, conditions: [] }
        },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      });
      await testForm.save();

      const result = await FormBuilderService.getFormBuilderData(
        testForm._id.toString(),
        testUser._id.toString()
      );

      expect(result.metadata.totalFields).toBe(2);
      expect(result.metadata.conditionalFields).toBe(1);
      expect(result.metadata.requiredFields).toBe(2);
    });
  });

  describe('addField', () => {
    it('should add a text field successfully', async () => {
      const fieldData = {
        type: 'text',
        label: 'New Text Field',
        placeholder: 'Enter text',
        required: true
      };

      const result = await FormBuilderService.addField(
        testForm._id.toString(),
        testUser._id.toString(),
        fieldData
      );

      expect(result.success).toBe(true);
      expect(result.field).toBeDefined();
      expect(result.field!.type).toBe('text');
      expect(result.field!.label).toBe('New Text Field');
      expect(result.field!.required).toBe(true);
      expect(result.totalFields).toBe(2);
      expect(result.message).toBe('Field added successfully');

      // Verify field was saved to database
      const updatedForm = await Form.findById(testForm._id);
      expect(updatedForm!.fields).toHaveLength(2);
      expect(updatedForm!.fields[1].type).toBe('text');
    });

    it('should add field at specified position', async () => {
      const fieldData = {
        type: 'email',
        label: 'Email Field',
        required: false
      };

      const result = await FormBuilderService.addField(
        testForm._id.toString(),
        testUser._id.toString(),
        fieldData,
        0 // Insert at beginning
      );

      expect(result.success).toBe(true);
      
      const updatedForm = await Form.findById(testForm._id);
      expect(updatedForm!.fields[0].type).toBe('email');
      expect(updatedForm!.fields[0].order).toBe(0);
      expect(updatedForm!.fields[1].order).toBe(1);
    });

    it('should add dropdown field with options', async () => {
      const fieldData = {
        type: 'dropdown',
        label: 'Dropdown Field',
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' }
        ]
      };

      const result = await FormBuilderService.addField(
        testForm._id.toString(),
        testUser._id.toString(),
        fieldData
      );

      expect(result.success).toBe(true);
      expect(result.field!.options).toEqual(['Option 1', 'Option 2']);
    });

    it('should handle number field with validation', async () => {
      const fieldData = {
        type: 'number',
        label: 'Number Field',
        validation: {
          min: 1,
          max: 100
        }
      };

      const result = await FormBuilderService.addField(
        testForm._id.toString(),
        testUser._id.toString(),
        fieldData
      );

      expect(result.success).toBe(true);
      expect(result.field!.validation).toEqual({
        minLength: 1,
        maxLength: 100
      });
    });

    it('should return error when form not found', async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId().toString();
      const fieldData = {
        type: 'text',
        label: 'Test Field'
      };

      const result = await FormBuilderService.addField(
        nonExistentFormId,
        testUser._id.toString(),
        fieldData
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Form not found or access denied');
    });
  });

  describe('updateField', () => {
    it('should update field successfully', async () => {
      const fieldId = testForm.fields[0].id;
      const updates = {
        label: 'Updated Label',
        placeholder: 'Updated placeholder',
        required: true
      };

      const result = await FormBuilderService.updateField(
        testForm._id.toString(),
        testUser._id.toString(),
        fieldId,
        updates
      );

      expect(result.success).toBe(true);
      expect(result.field!.label).toBe('Updated Label');
      expect(result.field!.placeholder).toBe('Updated placeholder');
      expect(result.field!.required).toBe(true);
      expect(result.message).toBe('Field updated successfully');

      // Verify field was updated in database
      const updatedForm = await Form.findById(testForm._id);
      expect(updatedForm!.fields[0].label).toBe('Updated Label');
    });

    it('should update dropdown options', async () => {
      // First add a dropdown field
      testForm.fields.push({
        id: 'dropdown1',
        type: 'dropdown',
        label: 'Dropdown',
        options: ['Old Option'],
        required: false,
        order: 1,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      });
      await testForm.save();

      const updates = {
        options: [
          { value: 'opt1', label: 'New Option 1' },
          { value: 'opt2', label: 'New Option 2' }
        ]
      };

      const result = await FormBuilderService.updateField(
        testForm._id.toString(),
        testUser._id.toString(),
        'dropdown1',
        updates
      );

      expect(result.success).toBe(true);
      expect(result.field!.options).toEqual(['New Option 1', 'New Option 2']);
    });

    it('should return error when field not found', async () => {
      const nonExistentFieldId = 'non-existent-field';
      const updates = { label: 'Updated' };

      const result = await FormBuilderService.updateField(
        testForm._id.toString(),
        testUser._id.toString(),
        nonExistentFieldId,
        updates
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Field not found');
    });

    it('should validate field configuration', async () => {
      const fieldId = testForm.fields[0].id;
      const updates = {
        label: '' // Empty label should fail validation
      };

      const result = await FormBuilderService.updateField(
        testForm._id.toString(),
        testUser._id.toString(),
        fieldId,
        updates
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Field validation failed');
    });
  });

  describe('deleteField', () => {
    beforeEach(async () => {
      // Add a second field for deletion tests
      testForm.fields.push({
        id: 'field2',
        type: 'email',
        label: 'Email Field',
        required: false,
        order: 1,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      });
      await testForm.save();
    });

    it('should delete field successfully', async () => {
      const fieldId = 'field2';

      const result = await FormBuilderService.deleteField(
        testForm._id.toString(),
        testUser._id.toString(),
        fieldId
      );

      expect(result.success).toBe(true);
      expect(result.totalFields).toBe(1);
      expect(result.message).toBe('Field deleted successfully');

      // Verify field was deleted from database
      const updatedForm = await Form.findById(testForm._id);
      expect(updatedForm!.fields).toHaveLength(1);
      expect(updatedForm!.fields[0].id).toBe('field1');
    });

    it('should reorder remaining fields after deletion', async () => {
      const fieldId = testForm.fields[0].id; // Delete first field

      await FormBuilderService.deleteField(
        testForm._id.toString(),
        testUser._id.toString(),
        fieldId
      );

      const updatedForm = await Form.findById(testForm._id);
      expect(updatedForm!.fields[0].order).toBe(0);
    });

    it('should clean up conditional logic references', async () => {
      // Add field with conditional logic referencing the field to be deleted
      testForm.fields.push({
        id: 'field3',
        type: 'text',
        label: 'Conditional Field',
        required: false,
        order: 2,
        conditional: {
          show: {
            enabled: true,
            conditions: [{
              fieldId: 'field2', // References field2
              operator: 'equals',
              value: 'test'
            }]
          },
          skip: { enabled: false, conditions: [] }
        },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      });
      await testForm.save();

      // Delete field2
      await FormBuilderService.deleteField(
        testForm._id.toString(),
        testUser._id.toString(),
        'field2'
      );

      const updatedForm = await Form.findById(testForm._id);
      const field3 = updatedForm!.fields.find(f => f.id === 'field3');
      expect(field3!.conditional.show.enabled).toBe(false);
      expect(field3!.conditional.show.conditions).toHaveLength(0);
    });

    it('should return error when field not found', async () => {
      const nonExistentFieldId = 'non-existent-field';

      const result = await FormBuilderService.deleteField(
        testForm._id.toString(),
        testUser._id.toString(),
        nonExistentFieldId
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Field not found');
    });
  });

  describe('reorderFields', () => {
    beforeEach(async () => {
      // Add more fields for reordering tests
      testForm.fields.push(
        {
          id: 'field2',
          type: 'email',
          label: 'Email Field',
          required: false,
          order: 1,
          conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
          answerRecall: { enabled: false },
          calculation: { enabled: false, dependencies: [], displayType: 'number' },
          prefill: { enabled: false },
          properties: {}
        },
        {
          id: 'field3',
          type: 'number',
          label: 'Number Field',
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
    });

    it('should reorder fields successfully', async () => {
      const newOrder = ['field3', 'field1', 'field2'];

      const result = await FormBuilderService.reorderFields(
        testForm._id.toString(),
        testUser._id.toString(),
        newOrder
      );

      expect(result.success).toBe(true);
      expect(result.fields).toHaveLength(3);
      expect(result.message).toBe('Fields reordered successfully');

      // Verify order was updated in database
      const updatedForm = await Form.findById(testForm._id);
      expect(updatedForm!.fields[0].id).toBe('field3');
      expect(updatedForm!.fields[0].order).toBe(0);
      expect(updatedForm!.fields[1].id).toBe('field1');
      expect(updatedForm!.fields[1].order).toBe(1);
      expect(updatedForm!.fields[2].id).toBe('field2');
      expect(updatedForm!.fields[2].order).toBe(2);
    });

    it('should return error when field order length mismatch', async () => {
      const invalidOrder = ['field1', 'field2']; // Missing field3

      const result = await FormBuilderService.reorderFields(
        testForm._id.toString(),
        testUser._id.toString(),
        invalidOrder
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Field order array length mismatch');
    });

    it('should return error when field ID not found', async () => {
      const invalidOrder = ['field1', 'field2', 'non-existent-field'];

      const result = await FormBuilderService.reorderFields(
        testForm._id.toString(),
        testUser._id.toString(),
        invalidOrder
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Field with ID non-existent-field not found');
    });
  });

  describe('setConditionalLogic', () => {
    beforeEach(async () => {
      // Add a second field for conditional logic tests
      testForm.fields.push({
        id: 'field2',
        type: 'text',
        label: 'Target Field',
        required: false,
        order: 1,
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      });
      await testForm.save();
    });

    it('should set conditional logic successfully', async () => {
      const logic = {
        conditions: [{
          fieldId: 'field1',
          operator: 'equals',
          value: 'show me'
        }],
        action: 'show' as const,
        operator: 'AND' as const
      };

      const result = await FormBuilderService.setConditionalLogic(
        testForm._id.toString(),
        testUser._id.toString(),
        'field2',
        logic
      );

      expect(result.success).toBe(true);
      expect(result.field!.conditional.show.enabled).toBe(true);
      expect(result.field!.conditional.show.conditions).toHaveLength(1);
      expect(result.message).toBe('Conditional logic set successfully');

      // Verify logic was saved to database
      const updatedForm = await Form.findById(testForm._id);
      const field2 = updatedForm!.fields.find(f => f.id === 'field2');
      expect(field2!.conditional.show.enabled).toBe(true);
      expect(field2!.conditional.show.conditions[0].fieldId).toBe('field1');
    });

    it('should return error when target field not found', async () => {
      const logic = {
        conditions: [{
          fieldId: 'field1',
          operator: 'equals',
          value: 'test'
        }],
        action: 'show' as const
      };

      const result = await FormBuilderService.setConditionalLogic(
        testForm._id.toString(),
        testUser._id.toString(),
        'non-existent-field',
        logic
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Field not found');
    });

    it('should validate conditional logic', async () => {
      const invalidLogic = {
        conditions: [], // Empty conditions array
        action: 'show' as const
      };

      const result = await FormBuilderService.setConditionalLogic(
        testForm._id.toString(),
        testUser._id.toString(),
        'field2',
        invalidLogic
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Conditional logic validation failed');
      expect(result.error).toContain('At least one condition is required');
    });

    it('should validate referenced field exists', async () => {
      const invalidLogic = {
        conditions: [{
          fieldId: 'non-existent-field',
          operator: 'equals',
          value: 'test'
        }],
        action: 'show' as const
      };

      const result = await FormBuilderService.setConditionalLogic(
        testForm._id.toString(),
        testUser._id.toString(),
        'field2',
        invalidLogic
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Referenced field not found');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Simulate database error by using invalid form ID
      const invalidFormId = 'invalid-form-id';
      
      const result = await FormBuilderService.addField(
        invalidFormId,
        testUser._id.toString(),
        { type: 'text', label: 'Test Field' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid ObjectId formats', async () => {
      const invalidId = 'invalid-object-id';

      await expect(
        FormBuilderService.getFormBuilderData(invalidId, testUser._id.toString())
      ).rejects.toThrow();
    });

    it('should handle forms with no fields', async () => {
      const emptyForm = await Form.create({
        ...TestUtils.createTestForm(testUser._id.toString()),
        title: 'Empty Form',
        fields: []
      });

      const result = await FormBuilderService.getFormBuilderData(
        emptyForm._id.toString(),
        testUser._id.toString()
      );

      expect(result.fields).toHaveLength(0);
      expect(result.metadata.totalFields).toBe(0);
      expect(result.metadata.conditionalFields).toBe(0);
      expect(result.metadata.requiredFields).toBe(0);
    });
  });
});