import { IFormField, IFormCustomization, IFormSettings, FormFieldType } from '../types';

/**
 * Typeform Import Service
 * Handles importing forms from Typeform format
 */
export class TypeformImportService {

  /**
   * Import form from Typeform JSON data
   * @param typeformData - Typeform form data
   * @param userId - User ID who's importing
   * @returns Converted form data
   */
  static async importFromTypeform(typeformData: any, userId: string): Promise<{
    title: string;
    description: string;
    fields: IFormField[];
    customization: IFormCustomization;
    settings: IFormSettings;
  }> {
    try {
      const convertedForm = {
        title: typeformData.title || 'Imported from Typeform',
        description: typeformData.description || '',
        fields: this.convertTypeformFields(typeformData.fields || []),
        customization: this.convertTypeformCustomization(typeformData.theme || {}),
        settings: this.convertTypeformSettings(typeformData.settings || {})
      };

      return convertedForm;
    } catch (error) {
      console.error('Typeform import error:', error);
      throw new Error('Failed to import form from Typeform');
    }
  }

  /**
   * Convert Typeform fields to our field format
   * @param typeformFields - Typeform fields array
   * @returns Converted fields
   */
  static convertTypeformFields(typeformFields: any[]): IFormField[] {
    return typeformFields.map((field, index) => {
      const convertedField: IFormField = {
        id: field.id || `field_${index}`,
        type: this.mapTypeformFieldType(field.type),
        label: field.title || `Field ${index + 1}`,
        placeholder: field.properties?.placeholder || '',
        required: field.validations?.required || false,
        order: index + 1,
        conditional: { 
          show: { enabled: false, conditions: [] }, 
          skip: { enabled: false, conditions: [] } 
        },
        answerRecall: { enabled: false },
        calculation: { enabled: false, formula: '', dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: this.convertFieldProperties(field.properties || {}, field.type)
      };

      // Add options for choice fields
      if (field.properties?.choices) {
        convertedField.options = field.properties.choices.map((choice: any) => choice.label);
      }

      // Handle field validation
      if (field.validations) {
        convertedField.validation = this.convertFieldValidation(field.validations);
      }

      return convertedField;
    });
  }

  /**
   * Map Typeform field types to our field types
   * @param typeformType - Typeform field type
   * @returns Our field type
   */
  static mapTypeformFieldType(typeformType: string): FormFieldType {
    const typeMapping: { [key: string]: FormFieldType } = {
      'short_text': 'text',
      'long_text': 'textarea',
      'multiple_choice': 'radio',
      'dropdown': 'dropdown',
      'yes_no': 'radio',
      'email': 'email',
      'number': 'number',
      'date': 'date',
      'file_upload': 'file',
      'phone_number': 'phone',
      'website': 'url',
      'rating': 'rating',
      'opinion_scale': 'scale',
      'picture_choice': 'radio',
      'legal': 'checkbox',
      'statement': 'heading',
      'group': 'divider'
    };

    return typeMapping[typeformType] || 'text';
  }

  /**
   * Convert Typeform field properties
   * @param properties - Typeform field properties
   * @param fieldType - Field type
   * @returns Converted properties
   */
  static convertFieldProperties(properties: any, fieldType: string): any {
    const convertedProps: any = {};

    switch (fieldType) {
      case 'rating':
        if (properties.steps) {
          convertedProps.ratingScale = {
            min: 1,
            max: properties.steps,
            step: 1,
            labels: {
              start: properties.start_at_one ? '1' : '0',
              end: properties.steps.toString()
            }
          };
        }
        break;

      case 'opinion_scale':
        if (properties.steps) {
          convertedProps.scale = {
            min: properties.start_at_one ? 1 : 0,
            max: properties.steps,
            step: 1,
            leftLabel: properties.labels?.left || '',
            rightLabel: properties.labels?.right || ''
          };
        }
        break;

      case 'file_upload':
        convertedProps.fileUpload = {
          maxFileSize: 10485760, // 10MB default
          allowedTypes: properties.allow_multiple_selection ? 
            ['.pdf', '.doc', '.docx', '.jpg', '.png'] : ['.pdf'],
          maxFiles: properties.allow_multiple_selection ? 5 : 1
        };
        break;

      case 'multiple_choice':
        if (properties.allow_multiple_selection) {
          // Convert to checkbox type if multiple selection allowed
          convertedProps.allowMultiple = true;
        }
        break;
    }

    return convertedProps;
  }

  /**
   * Convert Typeform field validation
   * @param validations - Typeform validations
   * @returns Our validation format
   */
  static convertFieldValidation(validations: any): any {
    const validation: any = {};

    if (validations.min_length) {
      validation.minLength = validations.min_length;
    }

    if (validations.max_length) {
      validation.maxLength = validations.max_length;
    }

    return validation;
  }

  /**
   * Convert Typeform customization/theme
   * @param theme - Typeform theme data
   * @returns Our customization format
   */
  static convertTypeformCustomization(theme: any): IFormCustomization {
    return {
      primaryColor: theme.colors?.button || '#3b82f6',
      fontFamily: theme.font || 'Inter',
      backgroundColor: theme.colors?.background || '#ffffff',
      theme: 'default',
      customCss: ''
    };
  }

  /**
   * Convert Typeform settings
   * @param settings - Typeform settings
   * @returns Our settings format
   */
  static convertTypeformSettings(settings: any): IFormSettings {
    return {
      isMultiStep: true, // Typeform is typically multi-step
      showProgressBar: settings.progress_bar !== false,
      allowBackNavigation: settings.show_progress_bar || false,
      allowMultipleSubmissions: !settings.is_trial,
      requireLogin: false,
      collectIpAddress: false,
      collectUserAgent: true,
      notifications: {
        email: { enabled: false, recipients: [] },
        webhook: { enabled: false, url: '', headers: new Map() }
      },
      autoSave: { enabled: true, interval: 30 },
      passwordProtection: { enabled: false },
      responseLimit: { enabled: false },
      schedule: { enabled: false },
      gdpr: { enabled: false, dataRetentionDays: 365 }
    };
  }

  /**
   * Parse Typeform share URL to extract form ID
   * @param url - Typeform URL
   * @returns Extracted form ID
   */
  static parseTypeformUrl(url: string): string | null {
    try {
      const urlPattern = /typeform\.com\/to\/([a-zA-Z0-9]+)/;
      const match = url.match(urlPattern);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate Typeform JSON structure
   * @param data - JSON data to validate
   * @returns Validation result
   */
  static validateTypeformData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Invalid JSON data format');
      return { isValid: false, errors };
    }

    if (!data.title && !data.fields) {
      errors.push('Missing required fields: title or fields');
    }

    if (data.fields && !Array.isArray(data.fields)) {
      errors.push('Fields must be an array');
    }

    if (data.fields) {
      data.fields.forEach((field: any, index: number) => {
        if (!field.type) {
          errors.push(`Field ${index + 1}: Missing field type`);
        }

        if (!field.title && !field.properties?.description) {
          errors.push(`Field ${index + 1}: Missing field title or description`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate preview of imported form
   * @param typeformData - Typeform data
   * @returns Preview information
   */
  static generateImportPreview(typeformData: any): {
    title: string;
    fieldCount: number;
    fieldTypes: string[];
    estimatedComplexity: 'simple' | 'medium' | 'complex';
    warnings: string[];
  } {
    const warnings: string[] = [];
    const fieldTypes = new Set<string>();

    if (typeformData.fields) {
      typeformData.fields.forEach((field: any) => {
        const mappedType = this.mapTypeformFieldType(field.type);
        fieldTypes.add(mappedType);

        // Check for unsupported features
        if (field.type === 'payment') {
          warnings.push('Payment fields are not directly supported and will be converted to text fields');
        }

        if (field.logic && field.logic.length > 0) {
          warnings.push('Logic jumps will need to be reconfigured after import');
        }

        if (field.properties?.randomize) {
          warnings.push('Option randomization is not supported and will be disabled');
        }
      });
    }

    const fieldCount = typeformData.fields?.length || 0;
    let complexity: 'simple' | 'medium' | 'complex' = 'simple';

    if (fieldCount > 20 || fieldTypes.size > 8) {
      complexity = 'complex';
    } else if (fieldCount > 10 || fieldTypes.size > 5) {
      complexity = 'medium';
    }

    return {
      title: typeformData.title || 'Untitled Form',
      fieldCount,
      fieldTypes: Array.from(fieldTypes),
      estimatedComplexity: complexity,
      warnings
    };
  }

  /**
   * Convert Typeform logic to our conditional logic
   * @param typeformLogic - Typeform logic rules
   * @param fieldMapping - Mapping of old to new field IDs
   * @returns Converted logic rules
   */
  static convertTypeformLogic(typeformLogic: any[], fieldMapping: Map<string, string>): any[] {
    // This is a complex conversion that would need detailed implementation
    // For now, return empty array and add warning
    return [];
  }

  /**
   * Import from Typeform API (if API key provided)
   * @param formId - Typeform form ID
   * @param apiKey - Typeform API key
   * @returns Form data from API
   */
  static async importFromTypeformAPI(formId: string, apiKey: string): Promise<any> {
    try {
      const axios = require('axios');
      
      const response = await axios.get(`https://api.typeform.com/forms/${formId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Typeform API key');
      } else if (error.response?.status === 404) {
        throw new Error('Typeform not found');
      } else {
        throw new Error('Failed to fetch from Typeform API');
      }
    }
  }

  /**
   * Export our form to Typeform-compatible format
   * @param formData - Our form data
   * @returns Typeform-compatible JSON
   */
  static exportToTypeformFormat(formData: any): any {
    const typeformData = {
      title: formData.title,
      description: formData.description,
      fields: formData.fields.map((field: IFormField, index: number) => ({
        id: field.id,
        title: field.label,
        type: this.mapOurFieldTypeToTypeform(field.type),
        properties: this.convertOurPropertiesToTypeform(field.properties, field.type),
        validations: field.validation ? {
          required: field.required,
          min_length: field.validation.minLength,
          max_length: field.validation.maxLength
        } : { required: field.required }
      })),
      theme: {
        colors: {
          button: formData.customization?.primaryColor || '#3b82f6',
          background: formData.customization?.backgroundColor || '#ffffff'
        },
        font: formData.customization?.fontFamily || 'Inter'
      },
      settings: {
        progress_bar: formData.settings?.showProgressBar || false,
        show_progress_bar: formData.settings?.allowBackNavigation || false
      }
    };

    return typeformData;
  }

  /**
   * Map our field types back to Typeform types
   * @param ourType - Our field type
   * @returns Typeform field type
   */
  static mapOurFieldTypeToTypeform(ourType: string): string {
    const reverseMapping: { [key: string]: string } = {
      'text': 'short_text',
      'textarea': 'long_text',
      'radio': 'multiple_choice',
      'dropdown': 'dropdown',
      'email': 'email',
      'number': 'number',
      'date': 'date',
      'file': 'file_upload',
      'phone': 'phone_number',
      'url': 'website',
      'rating': 'rating',
      'scale': 'opinion_scale',
      'checkbox': 'multiple_choice',
      'heading': 'statement'
    };

    return reverseMapping[ourType] || 'short_text';
  }

  /**
   * Convert our properties back to Typeform format
   * @param properties - Our properties
   * @param fieldType - Field type
   * @returns Typeform properties
   */
  static convertOurPropertiesToTypeform(properties: any, fieldType: string): any {
    const typeformProps: any = {};

    if (fieldType === 'rating' && properties?.ratingScale) {
      typeformProps.steps = properties.ratingScale.max;
      typeformProps.start_at_one = properties.ratingScale.min === 1;
    }

    if (fieldType === 'scale' && properties?.scale) {
      typeformProps.steps = properties.scale.max;
      typeformProps.start_at_one = properties.scale.min === 1;
      typeformProps.labels = {
        left: properties.scale.leftLabel || '',
        right: properties.scale.rightLabel || ''
      };
    }

    return typeformProps;
  }
}

export default TypeformImportService;