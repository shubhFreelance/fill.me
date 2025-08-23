import { IFormField, IAnswerRecall } from '../types';

/**
 * Answer Recall Service
 * Handles dynamic field population based on previous responses
 */
export class AnswerRecallService {

  /**
   * Process answer recall for all form fields
   * @param fields - Array of form fields
   * @param responses - Current user responses
   * @returns Object with recalled values for fields
   */
  static processAnswerRecall(fields: IFormField[], responses: Record<string, any>): Record<string, any> {
    const recalledValues: Record<string, any> = {};

    fields.forEach(field => {
      if (field.answerRecall?.enabled) {
        const recalledValue = this.calculateRecalledValue(field, responses, fields);
        if (recalledValue !== null && recalledValue !== undefined) {
          recalledValues[field.id] = recalledValue;
        }
      }
    });

    return recalledValues;
  }

  /**
   * Calculate recalled value for a specific field
   * @param field - Target field with answer recall configuration
   * @param responses - Current user responses
   * @param allFields - All form fields for reference
   * @returns Calculated recalled value
   */
  static calculateRecalledValue(
    field: IFormField, 
    responses: Record<string, any>, 
    allFields: IFormField[]
  ): any {
    const { answerRecall } = field;
    if (!answerRecall?.enabled) return null;

    // Direct source field recall
    if (answerRecall.sourceFieldId) {
      const sourceValue = responses[answerRecall.sourceFieldId];
      if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
        return this.formatRecalledValue(sourceValue, field.type, answerRecall);
      }
    }

    // Template-based recall
    if (answerRecall.template) {
      return this.processTemplate(answerRecall.template, responses, allFields);
    }

    return null;
  }

  /**
   * Process template string with dynamic values
   * @param template - Template string with placeholders
   * @param responses - User responses
   * @param allFields - All form fields for reference
   * @returns Processed template string
   */
  static processTemplate(
    template: string, 
    responses: Record<string, any>, 
    allFields: IFormField[]
  ): string {
    // Replace field references like {{fieldId}} with actual values
    let processedTemplate = template;

    // Find all field references in the template
    const fieldReferences = template.match(/\{\{([^}]+)\}\}/g);
    
    if (!fieldReferences) return template;

    fieldReferences.forEach(reference => {
      const fieldId = reference.replace(/\{\{|\}\}/g, '').trim();
      const fieldValue = responses[fieldId];
      const field = allFields.find(f => f.id === fieldId);

      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        const formattedValue = this.formatValueForTemplate(fieldValue, field?.type);
        processedTemplate = processedTemplate.replace(reference, formattedValue);
      } else {
        // Replace with empty string if no value
        processedTemplate = processedTemplate.replace(reference, '');
      }
    });

    // Process built-in functions
    processedTemplate = this.processBuiltinFunctions(processedTemplate, responses, allFields);

    return processedTemplate.trim();
  }

  /**
   * Format recalled value based on target field type
   * @param value - Source value
   * @param targetType - Target field type
   * @param answerRecall - Answer recall configuration
   * @returns Formatted value
   */
  static formatRecalledValue(value: any, targetType: string, answerRecall: IAnswerRecall): any {
    switch (targetType) {
      case 'text':
      case 'textarea':
        return String(value);
      
      case 'email':
        const emailValue = String(value).toLowerCase().trim();
        return this.isValidEmail(emailValue) ? emailValue : '';
      
      case 'number':
        const numValue = this.parseNumber(value);
        return numValue !== null ? numValue : '';
      
      case 'phone':
        return this.formatPhoneNumber(String(value));
      
      case 'url':
        const urlValue = String(value);
        return this.isValidUrl(urlValue) ? urlValue : '';
      
      case 'date':
        return this.formatDateValue(value);
      
      case 'dropdown':
      case 'radio':
        // For single-select fields, ensure the value is valid
        return String(value);
      
      case 'checkbox':
        // For checkboxes, ensure array format
        return Array.isArray(value) ? value : [value];
      
      default:
        return value;
    }
  }

  /**
   * Format value for use in templates
   * @param value - Field value
   * @param fieldType - Field type
   * @returns Formatted string value
   */
  static formatValueForTemplate(value: any, fieldType?: string): string {
    if (value === null || value === undefined) return '';

    switch (fieldType) {
      case 'checkbox':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);
      
      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return String(value);
      
      case 'number':
        if (typeof value === 'number') {
          return value.toLocaleString();
        }
        return String(value);
      
      case 'rating':
      case 'scale':
        return `${value}/10`; // Assuming max scale of 10
      
      default:
        return String(value);
    }
  }

  /**
   * Process built-in template functions
   * @param template - Template string
   * @param responses - User responses
   * @param allFields - All form fields
   * @returns Processed template
   */
  static processBuiltinFunctions(
    template: string, 
    responses: Record<string, any>, 
    allFields: IFormField[]
  ): string {
    let processedTemplate = template;

    // Function: uppercase({{fieldId}})
    processedTemplate = processedTemplate.replace(
      /uppercase\(\{\{([^}]+)\}\}\)/g,
      (match, fieldId) => {
        const value = responses[fieldId.trim()];
        return value ? String(value).toUpperCase() : '';
      }
    );

    // Function: lowercase({{fieldId}})
    processedTemplate = processedTemplate.replace(
      /lowercase\(\{\{([^}]+)\}\}\)/g,
      (match, fieldId) => {
        const value = responses[fieldId.trim()];
        return value ? String(value).toLowerCase() : '';
      }
    );

    // Function: capitalize({{fieldId}})
    processedTemplate = processedTemplate.replace(
      /capitalize\(\{\{([^}]+)\}\}\)/g,
      (match, fieldId) => {
        const value = responses[fieldId.trim()];
        return value ? this.capitalizeString(String(value)) : '';
      }
    );

    // Function: date_format({{fieldId}}, 'format')
    processedTemplate = processedTemplate.replace(
      /date_format\(\{\{([^}]+)\}\},\s*['"]([^'"]+)['"]\)/g,
      (match, fieldId, format) => {
        const value = responses[fieldId.trim()];
        if (value) {
          return this.formatDate(value, format);
        }
        return '';
      }
    );

    // Function: join({{fieldId}}, 'separator')
    processedTemplate = processedTemplate.replace(
      /join\(\{\{([^}]+)\}\},\s*['"]([^'"]+)['"]\)/g,
      (match, fieldId, separator) => {
        const value = responses[fieldId.trim()];
        if (Array.isArray(value)) {
          return value.join(separator);
        }
        return String(value || '');
      }
    );

    // Function: count({{fieldId}})
    processedTemplate = processedTemplate.replace(
      /count\(\{\{([^}]+)\}\}\)/g,
      (match, fieldId) => {
        const value = responses[fieldId.trim()];
        if (Array.isArray(value)) {
          return String(value.length);
        }
        return value ? '1' : '0';
      }
    );

    // Function: sum({{field1}}, {{field2}}, ...)
    processedTemplate = processedTemplate.replace(
      /sum\(([^)]+)\)/g,
      (match, fieldRefs) => {
        const fieldIds = fieldRefs.match(/\{\{([^}]+)\}\}/g);
        if (!fieldIds) return '0';
        
        let sum = 0;
        fieldIds.forEach((ref: string) => {
          const fieldId = ref.replace(/\{\{|\}\}/g, '').trim();
          const value = this.parseNumber(responses[fieldId]);
          if (value !== null) {
            sum += value;
          }
        });
        
        return String(sum);
      }
    );

    return processedTemplate;
  }

  /**
   * Get fields that have answer recall dependencies on a specific field
   * @param targetFieldId - Field ID to check dependencies for
   * @param allFields - All form fields
   * @returns Array of field IDs that depend on the target field
   */
  static getFieldDependencies(targetFieldId: string, allFields: IFormField[]): string[] {
    const dependencies: string[] = [];

    allFields.forEach(field => {
      if (!field.answerRecall?.enabled) return;

      // Check direct source field dependency
      if (field.answerRecall.sourceFieldId === targetFieldId) {
        dependencies.push(field.id);
      }

      // Check template dependencies
      if (field.answerRecall.template) {
        const templateFieldRefs = field.answerRecall.template.match(/\{\{([^}]+)\}\}/g);
        if (templateFieldRefs) {
          templateFieldRefs.forEach(ref => {
            const fieldId = ref.replace(/\{\{|\}\}/g, '').trim();
            if (fieldId === targetFieldId) {
              dependencies.push(field.id);
            }
          });
        }
      }
    });

    return dependencies;
  }

  /**
   * Validate answer recall configuration
   * @param fields - Form fields to validate
   * @returns Validation result
   */
  static validateAnswerRecall(fields: IFormField[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIds = new Set(fields.map(f => f.id));

    fields.forEach((field, index) => {
      if (!field.answerRecall?.enabled) return;

      const { answerRecall } = field;

      // Validate source field reference
      if (answerRecall.sourceFieldId) {
        if (!fieldIds.has(answerRecall.sourceFieldId)) {
          errors.push(`Field ${field.id}: Answer recall references non-existent field ${answerRecall.sourceFieldId}`);
        }

        // Check for self-reference
        if (answerRecall.sourceFieldId === field.id) {
          errors.push(`Field ${field.id}: Answer recall cannot reference itself`);
        }

        // Check for forward reference
        const sourceFieldIndex = fields.findIndex(f => f.id === answerRecall.sourceFieldId);
        if (sourceFieldIndex > index) {
          warnings.push(`Field ${field.id}: Answer recall references a field that comes later in the form (${answerRecall.sourceFieldId})`);
        }
      }

      // Validate template references
      if (answerRecall.template) {
        const templateFieldRefs = answerRecall.template.match(/\{\{([^}]+)\}\}/g);
        if (templateFieldRefs) {
          templateFieldRefs.forEach(ref => {
            const fieldId = ref.replace(/\{\{|\}\}/g, '').trim();
            if (!fieldIds.has(fieldId)) {
              errors.push(`Field ${field.id}: Template references non-existent field ${fieldId}`);
            }
            
            if (fieldId === field.id) {
              errors.push(`Field ${field.id}: Template cannot reference itself`);
            }
          });
        }
      }

      // Check for both source field and template
      if (answerRecall.sourceFieldId && answerRecall.template) {
        warnings.push(`Field ${field.id}: Has both source field and template configured. Template will take precedence.`);
      }

      // Check for neither source field nor template
      if (!answerRecall.sourceFieldId && !answerRecall.template) {
        errors.push(`Field ${field.id}: Answer recall is enabled but no source field or template is configured`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Helper methods

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static parseNumber(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.trim());
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private static formatPhoneNumber(phone: string): string {
    // Basic phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static formatDateValue(value: any): string {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    return String(value);
  }

  private static capitalizeString(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private static formatDate(value: any, format: string): string {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    // Simple format replacements
    let formatted = format;
    formatted = formatted.replace(/YYYY/g, date.getFullYear().toString());
    formatted = formatted.replace(/MM/g, (date.getMonth() + 1).toString().padStart(2, '0'));
    formatted = formatted.replace(/DD/g, date.getDate().toString().padStart(2, '0'));
    formatted = formatted.replace(/HH/g, date.getHours().toString().padStart(2, '0'));
    formatted = formatted.replace(/mm/g, date.getMinutes().toString().padStart(2, '0'));
    formatted = formatted.replace(/ss/g, date.getSeconds().toString().padStart(2, '0'));

    return formatted;
  }
}

export default AnswerRecallService;