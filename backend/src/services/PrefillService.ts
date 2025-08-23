import { IFormField, IPrefillSettings } from '../types';

/**
 * Prefill Service
 * Handles URL parameter pre-filling for form fields
 */
export class PrefillService {

  /**
   * Process URL parameters for form prefilling
   * @param fields - Array of form fields
   * @param urlParams - URL parameters object
   * @returns Object with prefilled values for fields
   */
  static processPrefillData(fields: IFormField[], urlParams: Record<string, string>): Record<string, any> {
    const prefilledValues: Record<string, any> = {};

    fields.forEach(field => {
      if (field.prefill?.enabled) {
        const prefilledValue = this.getPrefillValue(field, urlParams);
        if (prefilledValue !== null && prefilledValue !== undefined) {
          prefilledValues[field.id] = prefilledValue;
        }
      }
    });

    return prefilledValues;
  }

  /**
   * Get prefill value for a specific field
   * @param field - Target field with prefill configuration
   * @param urlParams - URL parameters
   * @returns Prefilled value
   */
  static getPrefillValue(field: IFormField, urlParams: Record<string, string>): any {
    const { prefill } = field;
    if (!prefill?.enabled) return null;

    // Check URL parameter first
    if (prefill.urlParameter && urlParams[prefill.urlParameter]) {
      const paramValue = urlParams[prefill.urlParameter];
      return this.formatPrefillValue(paramValue, field.type, field);
    }

    // Fall back to default value
    if (prefill.defaultValue !== undefined && prefill.defaultValue !== null) {
      return this.formatPrefillValue(prefill.defaultValue, field.type, field);
    }

    return null;
  }

  /**
   * Format prefill value based on field type
   * @param value - Raw prefill value
   * @param fieldType - Target field type
   * @param field - Field configuration
   * @returns Formatted value
   */
  static formatPrefillValue(value: any, fieldType: string, field: IFormField): any {
    try {
      switch (fieldType) {
        case 'text':
        case 'textarea':
          return this.decodeUrlValue(String(value));
        
        case 'email':
          const email = this.decodeUrlValue(String(value)).toLowerCase().trim();
          return this.isValidEmail(email) ? email : '';
        
        case 'number':
          const numValue = this.parseNumber(value);
          return numValue !== null ? numValue : '';
        
        case 'phone':
          return this.formatPhoneNumber(this.decodeUrlValue(String(value)));
        
        case 'url':
          const urlValue = this.decodeUrlValue(String(value));
          return this.isValidUrl(urlValue) ? urlValue : '';
        
        case 'date':
          return this.formatDateValue(value);
        
        case 'dropdown':
        case 'radio':
          const decodedValue = this.decodeUrlValue(String(value));
          return this.isValidOption(decodedValue, field.options) ? decodedValue : '';
        
        case 'checkbox':
          return this.formatCheckboxValue(value, field.options);
        
        case 'rating':
        case 'scale':
          const ratingValue = this.parseNumber(value);
          return this.isValidRating(ratingValue, field) ? ratingValue : null;
        
        default:
          return this.decodeUrlValue(String(value));
      }
    } catch (error) {
      console.error(`Prefill formatting error for field ${field.id}:`, error);
      return null;
    }
  }

  /**
   * Validate prefill configuration
   * @param fields - Form fields to validate
   * @returns Validation result
   */
  static validatePrefillConfig(fields: IFormField[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const usedParams = new Set<string>();

    fields.forEach(field => {
      if (!field.prefill?.enabled) return;

      const { prefill } = field;

      // Check for URL parameter
      if (prefill.urlParameter) {
        // Validate parameter name format
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(prefill.urlParameter)) {
          warnings.push(`Field ${field.id}: URL parameter '${prefill.urlParameter}' should start with a letter and contain only letters, numbers, underscores, and hyphens`);
        }

        // Check for duplicate parameters
        if (usedParams.has(prefill.urlParameter)) {
          warnings.push(`URL parameter '${prefill.urlParameter}' is used by multiple fields`);
        } else {
          usedParams.add(prefill.urlParameter);
        }
      }

      // Check for either URL parameter or default value
      if (!prefill.urlParameter && prefill.defaultValue === undefined) {
        errors.push(`Field ${field.id}: Prefill is enabled but no URL parameter or default value is configured`);
      }

      // Validate default value format
      if (prefill.defaultValue !== undefined) {
        try {
          this.formatPrefillValue(prefill.defaultValue, field.type, field);
        } catch (error) {
          warnings.push(`Field ${field.id}: Default value may not be compatible with field type ${field.type}`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate prefill URL for a form
   * @param baseUrl - Base form URL
   * @param fields - Form fields
   * @param values - Values to prefill
   * @returns Generated URL with parameters
   */
  static generatePrefillUrl(baseUrl: string, fields: IFormField[], values: Record<string, any>): string {
    const url = new URL(baseUrl);
    
    fields.forEach(field => {
      if (field.prefill?.enabled && field.prefill.urlParameter && values[field.id] !== undefined) {
        const value = values[field.id];
        const encodedValue = this.encodeUrlValue(value, field.type);
        if (encodedValue) {
          url.searchParams.set(field.prefill.urlParameter, encodedValue);
        }
      }
    });

    return url.toString();
  }

  /**
   * Extract prefill parameters from form fields
   * @param fields - Form fields
   * @returns Array of prefill parameter configurations
   */
  static extractPrefillParams(fields: IFormField[]): Array<{
    fieldId: string;
    fieldLabel: string;
    fieldType: string;
    urlParameter: string;
    required: boolean;
    hasDefault: boolean;
  }> {
    return fields
      .filter(field => field.prefill?.enabled && field.prefill.urlParameter)
      .map(field => ({
        fieldId: field.id,
        fieldLabel: field.label,
        fieldType: field.type,
        urlParameter: field.prefill!.urlParameter!,
        required: field.required,
        hasDefault: field.prefill!.defaultValue !== undefined
      }));
  }

  // Helper methods

  private static decodeUrlValue(value: string): string {
    try {
      return decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      return value;
    }
  }

  private static encodeUrlValue(value: any, fieldType: string): string {
    if (value === null || value === undefined) return '';
    
    let stringValue: string;
    
    if (fieldType === 'checkbox' && Array.isArray(value)) {
      stringValue = value.join(',');
    } else {
      stringValue = String(value);
    }
    
    return encodeURIComponent(stringValue);
  }

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

  private static isValidOption(value: string, options?: string[]): boolean {
    if (!options || options.length === 0) return true;
    return options.includes(value);
  }

  private static formatCheckboxValue(value: any, options?: string[]): string[] {
    if (Array.isArray(value)) {
      return options ? value.filter(v => options.includes(v)) : value;
    }
    
    if (typeof value === 'string') {
      const values = value.split(',').map(v => v.trim());
      return options ? values.filter(v => options.includes(v)) : values;
    }
    
    return [];
  }

  private static isValidRating(value: number | null, field: IFormField): boolean {
    if (value === null) return false;
    
    const props = field.properties?.ratingScale || field.properties?.scale;
    if (props) {
      return value >= (props.min || 1) && value <= (props.max || 5);
    }
    
    return value >= 1 && value <= 10; // Default range
  }
}

export default PrefillService;