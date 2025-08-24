import { Types } from 'mongoose';
import Form from '../models/Form';
import { IForm, IFormField, FormFieldType, ICondition } from '../types';

/**
 * Enhanced Form Builder Service
 * Provides advanced form building capabilities with conditional logic UI support
 */
export class FormBuilderService {

  /**
   * Get form builder data with enhanced field metadata
   * @param formId - Form identifier
   * @param userId - User identifier
   * @returns Enhanced form data for builder
   */
  static async getFormBuilderData(formId: string, userId: string): Promise<IFormBuilderData> {
    try {
      const form = await Form.findOne({ _id: formId, userId, isActive: true });
      
      if (!form) {
        throw new Error('Form not found or access denied');
      }

      // Enhance fields with builder metadata
      const enhancedFields = form.fields.map(field => this.enhanceFieldForBuilder(field));

      // Get conditional logic configuration
      const conditionalLogic = await this.getConditionalLogicConfig(form);

      // Get field dependencies
      const fieldDependencies = this.analyzeFieldDependencies(form.fields);

      // Get available field types with their configurations
      const availableFieldTypes = this.getAvailableFieldTypes();

      return {
        formId: form._id.toString(),
        title: form.title,
        description: form.description,
        fields: enhancedFields,
        conditionalLogic,
        fieldDependencies,
        availableFieldTypes,
        settings: {
          autoSave: form.settings?.autoSave || { enabled: false, interval: 30 },
          validation: { enabled: true, showErrors: true }, // Default validation settings
          theme: form.customization || {},
          submission: {
            allowMultiple: form.settings?.allowMultipleSubmissions || false,
            requireAuth: form.settings?.requireLogin || false
          }
        },
        metadata: {
          totalFields: form.fields.length,
          conditionalFields: form.fields.filter(f => f.conditional?.show?.enabled || f.conditional?.skip?.enabled).length,
          requiredFields: form.fields.filter(f => f.required).length,
          lastModified: form.updatedAt,
          version: 1 // Default version
        }
      };
    } catch (error) {
      console.error('Form builder data error:', error);
      throw error;
    }
  }

  /**
   * Add field to form with enhanced configuration
   * @param formId - Form identifier
   * @param userId - User identifier
   * @param fieldData - Field configuration
   * @param position - Field position (optional)
   * @returns Updated form with new field
   */
  static async addField(
    formId: string, 
    userId: string, 
    fieldData: IEnhancedFieldData,
    position?: number
  ): Promise<IFormBuilderResponse> {
    try {
      const form = await Form.findOne({ _id: formId, userId, isActive: true });
      
      if (!form) {
        throw new Error('Form not found or access denied');
      }

      // Create enhanced field
      const newField = this.createEnhancedField(fieldData, form.fields.length);

      // Insert field at specified position or append
      if (position !== undefined && position >= 0 && position <= form.fields.length) {
        form.fields.splice(position, 0, newField);
      } else {
        form.fields.push(newField);
      }

      // Reorder field indices
      form.fields.forEach((field, index) => {
        field.order = index;
      });

      await form.save();

      return {
        success: true,
        field: this.enhanceFieldForBuilder(newField),
        totalFields: form.fields.length,
        message: 'Field added successfully'
      };
    } catch (error) {
      console.error('Add field error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add field'
      };
    }
  }

  /**
   * Update field configuration
   * @param formId - Form identifier
   * @param userId - User identifier
   * @param fieldId - Field identifier
   * @param updates - Field updates
   * @returns Updated field data
   */
  static async updateField(
    formId: string,
    userId: string,
    fieldId: string,
    updates: Partial<IEnhancedFieldData>
  ): Promise<IFormBuilderResponse> {
    try {
      const form = await Form.findOne({ _id: formId, userId, isActive: true });
      
      if (!form) {
        throw new Error('Form not found or access denied');
      }

      const fieldIndex = form.fields.findIndex(f => f.id === fieldId);
      if (fieldIndex === -1) {
        throw new Error('Field not found');
      }

      // Update field with new configuration
      const field = form.fields[fieldIndex];
      Object.assign(field, this.sanitizeFieldUpdates(updates));

      // Validate field configuration
      const validation = this.validateFieldConfiguration(field);
      if (!validation.isValid) {
        throw new Error(`Field validation failed: ${validation.errors.join(', ')}`);
      }

      await form.save();

      return {
        success: true,
        field: this.enhanceFieldForBuilder(field),
        message: 'Field updated successfully'
      };
    } catch (error) {
      console.error('Update field error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update field'
      };
    }
  }

  /**
   * Delete field from form
   * @param formId - Form identifier
   * @param userId - User identifier
   * @param fieldId - Field identifier
   * @returns Deletion result
   */
  static async deleteField(
    formId: string,
    userId: string,
    fieldId: string
  ): Promise<IFormBuilderResponse> {
    try {
      const form = await Form.findOne({ _id: formId, userId, isActive: true });
      
      if (!form) {
        throw new Error('Form not found or access denied');
      }

      const fieldIndex = form.fields.findIndex(f => f.id === fieldId);
      if (fieldIndex === -1) {
        throw new Error('Field not found');
      }

      // Remove field
      form.fields.splice(fieldIndex, 1);

      // Update field order
      form.fields.forEach((field, index) => {
        field.order = index;
      });

      // Clean up conditional logic references
      this.cleanupConditionalLogicReferences(form, fieldId);

      await form.save();

      return {
        success: true,
        totalFields: form.fields.length,
        message: 'Field deleted successfully'
      };
    } catch (error) {
      console.error('Delete field error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete field'
      };
    }
  }

  /**
   * Reorder fields in form
   * @param formId - Form identifier
   * @param userId - User identifier
   * @param fieldOrder - Array of field IDs in new order
   * @returns Reorder result
   */
  static async reorderFields(
    formId: string,
    userId: string,
    fieldOrder: string[]
  ): Promise<IFormBuilderResponse> {
    try {
      const form = await Form.findOne({ _id: formId, userId, isActive: true });
      
      if (!form) {
        throw new Error('Form not found or access denied');
      }

      // Validate field order array
      if (fieldOrder.length !== form.fields.length) {
        throw new Error('Field order array length mismatch');
      }

      // Create field map for quick lookup
      const fieldMap = new Map(form.fields.map(f => [f.id, f]));

      // Reorder fields based on provided order
      const reorderedFields = fieldOrder.map((fieldId, index) => {
        const field = fieldMap.get(fieldId);
        if (!field) {
          throw new Error(`Field with ID ${fieldId} not found`);
        }
        field.order = index;
        return field;
      });

      form.fields = reorderedFields;
      await form.save();

      return {
        success: true,
        fields: reorderedFields.map(f => this.enhanceFieldForBuilder(f)),
        message: 'Fields reordered successfully'
      };
    } catch (error) {
      console.error('Reorder fields error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reorder fields'
      };
    }
  }

  /**
   * Set conditional logic for a field
   * @param formId - Form identifier
   * @param userId - User identifier
   * @param fieldId - Field identifier
   * @param logic - Conditional logic configuration
   * @returns Logic configuration result
   */
  static async setConditionalLogic(
    formId: string,
    userId: string,
    fieldId: string,
    logic: IConditionalLogic
  ): Promise<IFormBuilderResponse> {
    try {
      const form = await Form.findOne({ _id: formId, userId, isActive: true });
      
      if (!form) {
        throw new Error('Form not found or access denied');
      }

      const field = form.fields.find(f => f.id === fieldId);
      if (!field) {
        throw new Error('Field not found');
      }

      // Validate conditional logic
      const validation = this.validateConditionalLogic(logic, form.fields);
      if (!validation.isValid) {
        throw new Error(`Conditional logic validation failed: ${validation.errors.join(', ')}`);
      }

      // Set conditional logic
      field.conditional = {
        show: {
          enabled: true,
          conditions: logic.conditions as ICondition[]
        },
        skip: {
          enabled: false,
          conditions: []
        }
      };

      await form.save();

      return {
        success: true,
        field: this.enhanceFieldForBuilder(field),
        message: 'Conditional logic set successfully'
      };
    } catch (error) {
      console.error('Set conditional logic error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set conditional logic'
      };
    }
  }

  // Helper methods

  private static enhanceFieldForBuilder(field: IFormField): IEnhancedField {
    return {
      ...field,
      builderMetadata: {
        canDelete: true,
        canReorder: true,
        canAddLogic: this.canFieldHaveLogic(field.type),
        hasLogic: field.conditional?.show?.enabled || field.conditional?.skip?.enabled || false,
        dependencies: this.getFieldDependencies(field),
        supportedValidations: this.getSupportedValidations(field.type),
        defaultValue: this.getFieldDefaultValue(field.type)
      }
    };
  }

  private static createEnhancedField(fieldData: IEnhancedFieldData, order: number): IFormField {
    const baseField: IFormField = {
      id: fieldData.id || this.generateFieldId(),
      type: fieldData.type as FormFieldType,
      label: fieldData.label,
      placeholder: fieldData.placeholder || '',
      required: fieldData.required || false,
      order: order,
      options: [],
      validation: fieldData.validation || {},
      conditional: fieldData.conditional ? {
        show: {
          enabled: fieldData.conditional.enabled || false,
          conditions: (fieldData.conditional.conditions || []).map((condition: any) => ({
            fieldId: condition.fieldId,
            operator: condition.operator as 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty',
            value: condition.value,
            logicalOperator: condition.logicalOperator as 'and' | 'or' | undefined
          }))
        },
        skip: {
          enabled: false,
          conditions: []
        }
      } : { 
        show: { enabled: false, conditions: [] },
        skip: { enabled: false, conditions: [] }
      },
      answerRecall: {
        enabled: false,
        sourceFieldId: undefined,
        template: undefined
      },
      calculation: {
        enabled: false,
        formula: undefined,
        dependencies: [],
        displayType: 'number'
      },
      prefill: {
        enabled: false,
        urlParameter: undefined,
        defaultValue: undefined
      },
      properties: {}
    };

    // Add type-specific configurations
    switch (fieldData.type) {
      case 'dropdown':
      case 'radio':
      case 'checkbox':
        if (Array.isArray(fieldData.options) && fieldData.options.length > 0) {
          if (typeof fieldData.options[0] === 'object' && fieldData.options[0] && 'label' in fieldData.options[0]) {
            baseField.options = fieldData.options.map((opt: any) => opt.label);
          } else {
            baseField.options = (fieldData.options as unknown) as string[];
          }
        } else {
          baseField.options = [];
        }
        break;
      case 'number':
        baseField.validation = {
          ...baseField.validation,
          minLength: fieldData.validation?.min,
          maxLength: fieldData.validation?.max
        };
        break;
      case 'text':
      case 'textarea':
        baseField.validation = {
          ...baseField.validation,
          minLength: fieldData.validation?.minLength,
          maxLength: fieldData.validation?.maxLength,
          pattern: fieldData.validation?.pattern
        };
        break;
    }

    return baseField;
  }

  private static generateFieldId(): string {
    return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static sanitizeFieldUpdates(updates: Partial<IEnhancedFieldData>): Partial<IFormField> {
    const sanitized: Partial<IFormField> = {};

    if (updates.label !== undefined) sanitized.label = updates.label;
    if (updates.placeholder !== undefined) sanitized.placeholder = updates.placeholder;
    if (updates.required !== undefined) sanitized.required = updates.required;
    if (updates.options !== undefined) {
      // Convert array of objects to array of strings if needed
      if (Array.isArray(updates.options) && updates.options.length > 0) {
        if (typeof updates.options[0] === 'object' && updates.options[0] && 'label' in updates.options[0]) {
          sanitized.options = updates.options.map((opt: any) => opt.label);
        } else {
          sanitized.options = (updates.options as unknown) as string[];
        }
      } else {
        sanitized.options = (updates.options as unknown) as string[];
      }
    }
    if (updates.validation !== undefined) sanitized.validation = updates.validation;

    return sanitized;
  }

  private static validateFieldConfiguration(field: IFormField): IValidationResult {
    const errors: string[] = [];

    // Basic validation
    if (!field.label || field.label.trim().length === 0) {
      errors.push('Field label is required');
    }

    // Type-specific validation
    switch (field.type) {
      case 'dropdown':
      case 'radio':
        if (!field.options || field.options.length === 0) {
          errors.push(`${field.type} field must have at least one option`);
        }
        break;
      case 'checkbox':
        if (!field.options || field.options.length === 0) {
          errors.push('Checkbox field must have at least one option');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static validateConditionalLogic(logic: IConditionalLogic, allFields: IFormField[]): IValidationResult {
    const errors: string[] = [];

    // Validate conditions
    if (!logic.conditions || logic.conditions.length === 0) {
      errors.push('At least one condition is required');
    }

    logic.conditions.forEach((condition, index) => {
      // Check if referenced field exists
      const referencedField = allFields.find(f => f.id === condition.fieldId);
      if (!referencedField) {
        errors.push(`Condition ${index + 1}: Referenced field not found`);
      }

      // Validate operator and value
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: Operator is required`);
      }

      if (condition.value === undefined || condition.value === null) {
        errors.push(`Condition ${index + 1}: Value is required`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static cleanupConditionalLogicReferences(form: IForm, deletedFieldId: string): void {
    form.fields.forEach(field => {
      // Update show conditions
      if (field.conditional?.show?.enabled && field.conditional.show.conditions) {
        field.conditional.show.conditions = field.conditional.show.conditions.filter(
          (condition: any) => condition.fieldId !== deletedFieldId
        );
        
        if (field.conditional.show.conditions.length === 0) {
          field.conditional.show.enabled = false;
        }
      }
      
      // Update skip conditions
      if (field.conditional?.skip?.enabled && field.conditional.skip.conditions) {
        field.conditional.skip.conditions = field.conditional.skip.conditions.filter(
          (condition: any) => condition.fieldId !== deletedFieldId
        );
        
        if (field.conditional.skip.conditions.length === 0) {
          field.conditional.skip.enabled = false;
        }
      }
    });
  }

  private static getConditionalLogicConfig(form: IForm): IConditionalLogicConfig {
    const fieldsWithLogic = form.fields.filter(f => f.conditional?.show?.enabled || f.conditional?.skip?.enabled);
    
    return {
      enabled: fieldsWithLogic.length > 0,
      totalLogicFields: fieldsWithLogic.length,
      logicMap: fieldsWithLogic.reduce((map, field) => {
        map[field.id] = {
          conditions: field.conditional?.show?.conditions || field.conditional?.skip?.conditions || [],
          action: 'show',
          operator: 'AND'
        };
        return map;
      }, {} as Record<string, any>)
    };
  }

  private static analyzeFieldDependencies(fields: IFormField[]): IFieldDependency[] {
    const dependencies: IFieldDependency[] = [];

    fields.forEach(field => {
      // Check show conditions
      if (field.conditional?.show?.enabled && field.conditional.show.conditions) {
        field.conditional.show.conditions.forEach((condition: any) => {
          dependencies.push({
            fieldId: field.id,
            dependsOn: condition.fieldId,
            type: 'conditional'
          });
        });
      }
      
      // Check skip conditions
      if (field.conditional?.skip?.enabled && field.conditional.skip.conditions) {
        field.conditional.skip.conditions.forEach((condition: any) => {
          dependencies.push({
            fieldId: field.id,
            dependsOn: condition.fieldId,
            type: 'conditional'
          });
        });
      }
    });

    return dependencies;
  }

  private static getAvailableFieldTypes(): IFieldTypeConfig[] {
    return [
      { type: 'text', label: 'Text Input', icon: 'text', category: 'input' },
      { type: 'textarea', label: 'Text Area', icon: 'textarea', category: 'input' },
      { type: 'email', label: 'Email', icon: 'email', category: 'input' },
      { type: 'number', label: 'Number', icon: 'number', category: 'input' },
      { type: 'date', label: 'Date', icon: 'calendar', category: 'input' },
      { type: 'dropdown', label: 'Dropdown', icon: 'dropdown', category: 'choice' },
      { type: 'radio', label: 'Radio Buttons', icon: 'radio', category: 'choice' },
      { type: 'checkbox', label: 'Checkboxes', icon: 'checkbox', category: 'choice' },
      { type: 'file', label: 'File Upload', icon: 'upload', category: 'media' }
    ];
  }

  private static canFieldHaveLogic(fieldType: string): boolean {
    // All fields except file uploads can have conditional logic
    return fieldType !== 'file';
  }

  private static getFieldDependencies(field: IFormField): string[] {
    const dependencies: string[] = [];
    
    // Check show conditions
    if (field.conditional?.show?.enabled && field.conditional.show.conditions) {
      dependencies.push(...field.conditional.show.conditions.map((condition: any) => condition.fieldId));
    }
    
    // Check skip conditions
    if (field.conditional?.skip?.enabled && field.conditional.skip.conditions) {
      dependencies.push(...field.conditional.skip.conditions.map((condition: any) => condition.fieldId));
    }
    
    return dependencies;
  }

  private static getSupportedValidations(fieldType: string): string[] {
    const validationMap: Record<string, string[]> = {
      text: ['required', 'minLength', 'maxLength', 'pattern'],
      textarea: ['required', 'minLength', 'maxLength'],
      email: ['required'],
      number: ['required', 'min', 'max'],
      date: ['required', 'minDate', 'maxDate'],
      dropdown: ['required'],
      radio: ['required'],
      checkbox: ['required', 'minSelected', 'maxSelected'],
      file: ['required', 'fileType', 'maxSize']
    };

    return validationMap[fieldType] || ['required'];
  }

  private static getFieldDefaultValue(fieldType: string): any {
    const defaultValues: Record<string, any> = {
      text: '',
      textarea: '',
      email: '',
      number: null,
      date: null,
      dropdown: null,
      radio: null,
      checkbox: [],
      file: null
    };

    return defaultValues[fieldType];
  }
}

// Type definitions
export interface IFormBuilderData {
  formId: string;
  title: string;
  description?: string;
  fields: IEnhancedField[];
  conditionalLogic: IConditionalLogicConfig;
  fieldDependencies: IFieldDependency[];
  availableFieldTypes: IFieldTypeConfig[];
  settings: {
    autoSave: { enabled: boolean; interval: number };
    validation: { enabled: boolean; showErrors: boolean };
    theme: any;
    submission: {
      allowMultiple: boolean;
      requireAuth: boolean;
    };
  };
  metadata: {
    totalFields: number;
    conditionalFields: number;
    requiredFields: number;
    lastModified: Date;
    version: number;
  };
}

export interface IEnhancedField extends IFormField {
  builderMetadata: {
    canDelete: boolean;
    canReorder: boolean;
    canAddLogic: boolean;
    hasLogic: boolean;
    dependencies: string[];
    supportedValidations: string[];
    defaultValue: any;
  };
}

export interface IEnhancedFieldData {
  id?: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: Record<string, any>;
  conditional?: {
    enabled: boolean;
    conditions?: Array<{
      fieldId: string;
      operator: string;
      value: any;
    }>;
    action?: 'show' | 'hide' | 'require';
    operator?: 'AND' | 'OR';
  };
}

export interface IFormBuilderResponse {
  success: boolean;
  field?: IEnhancedField;
  fields?: IEnhancedField[];
  totalFields?: number;
  message?: string;
  error?: string;
}

export interface IConditionalLogic {
  conditions: Array<{
    fieldId: string;
    operator: string;
    value: any;
  }>;
  action: 'show' | 'hide' | 'require';
  operator?: 'AND' | 'OR';
}

export interface IConditionalLogicConfig {
  enabled: boolean;
  totalLogicFields: number;
  logicMap: Record<string, any>;
}

export interface IFieldDependency {
  fieldId: string;
  dependsOn: string;
  type: 'conditional' | 'calculation';
}

export interface IFieldTypeConfig {
  type: string;
  label: string;
  icon: string;
  category: 'input' | 'choice' | 'media';
}

export interface IValidationResult {
  isValid: boolean;
  errors: string[];
}

export default FormBuilderService;