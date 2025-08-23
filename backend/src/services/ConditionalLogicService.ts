import { IFormField, ICondition, IConditionalLogic } from '../types';

/**
 * Conditional Logic Service
 * Handles form field visibility and skip logic based on user responses
 */
export class ConditionalLogicService {
  
  /**
   * Evaluate conditional logic for all form fields
   * @param fields - Array of form fields with conditional logic
   * @param responses - User responses object
   * @returns Object with field visibility and skip logic results
   */
  static evaluateFormLogic(fields: IFormField[], responses: Record<string, any>) {
    const result = {
      visibleFields: new Set<string>(),
      hiddenFields: new Set<string>(),
      skipTargets: new Map<string, string>(),
      fieldStates: new Map<string, {
        visible: boolean;
        skipTo?: string;
        reason?: string;
      }>()
    };

    // First pass: evaluate visibility conditions
    fields.forEach(field => {
      const isVisible = this.evaluateFieldVisibility(field, responses, fields);
      const skipTarget = this.evaluateSkipLogic(field, responses, fields);

      if (isVisible) {
        result.visibleFields.add(field.id);
      } else {
        result.hiddenFields.add(field.id);
      }

      if (skipTarget) {
        result.skipTargets.set(field.id, skipTarget);
      }

      result.fieldStates.set(field.id, {
        visible: isVisible,
        skipTo: skipTarget,
        reason: this.getLogicReason(field, responses, isVisible, skipTarget)
      });
    });

    return result;
  }

  /**
   * Evaluate visibility conditions for a single field
   * @param field - Form field to evaluate
   * @param responses - User responses
   * @param allFields - All form fields for reference
   * @returns Boolean indicating if field should be visible
   */
  static evaluateFieldVisibility(
    field: IFormField, 
    responses: Record<string, any>, 
    allFields: IFormField[]
  ): boolean {
    const { conditional } = field;
    
    // If no show conditions are defined, field is visible by default
    if (!conditional?.show?.enabled || !conditional.show.conditions?.length) {
      return true;
    }

    return this.evaluateConditions(conditional.show.conditions, responses, allFields);
  }

  /**
   * Evaluate skip logic for a single field
   * @param field - Form field to evaluate
   * @param responses - User responses
   * @param allFields - All form fields for reference
   * @returns Target field ID to skip to, or null
   */
  static evaluateSkipLogic(
    field: IFormField, 
    responses: Record<string, any>, 
    allFields: IFormField[]
  ): string | null {
    const { conditional } = field;
    
    // If no skip conditions are defined, no skip logic
    if (!conditional?.skip?.enabled || !conditional.skip.conditions?.length) {
      return null;
    }

    const shouldSkip = this.evaluateConditions(conditional.skip.conditions, responses, allFields);
    
    return shouldSkip ? conditional.skip.targetFieldId || null : null;
  }

  /**
   * Evaluate a set of conditions
   * @param conditions - Array of conditions to evaluate
   * @param responses - User responses
   * @param allFields - All form fields for reference
   * @returns Boolean result of condition evaluation
   */
  static evaluateConditions(
    conditions: ICondition[], 
    responses: Record<string, any>, 
    allFields: IFormField[]
  ): boolean {
    if (!conditions.length) return true;

    let result = this.evaluateSingleCondition(conditions[0], responses, allFields);

    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = this.evaluateSingleCondition(condition, responses, allFields);
      
      if (condition.logicalOperator === 'or') {
        result = result || conditionResult;
      } else {
        // Default to 'and'
        result = result && conditionResult;
      }
    }

    return result;
  }

  /**
   * Evaluate a single condition
   * @param condition - Condition to evaluate
   * @param responses - User responses
   * @param allFields - All form fields for reference
   * @returns Boolean result of condition evaluation
   */
  static evaluateSingleCondition(
    condition: ICondition, 
    responses: Record<string, any>, 
    allFields: IFormField[]
  ): boolean {
    const { fieldId, operator, value } = condition;
    const fieldValue = responses[fieldId];
    const field = allFields.find(f => f.id === fieldId);

    if (!field) {
      console.warn(`Field ${fieldId} not found for condition evaluation`);
      return false;
    }

    return this.compareValues(fieldValue, operator, value, field.type);
  }

  /**
   * Compare values based on operator
   * @param fieldValue - Actual field value from responses
   * @param operator - Comparison operator
   * @param expectedValue - Expected value from condition
   * @param fieldType - Type of the field being compared
   * @returns Boolean result of comparison
   */
  static compareValues(
    fieldValue: any, 
    operator: string, 
    expectedValue: any, 
    fieldType: string
  ): boolean {
    // Handle empty/null values
    const isEmpty = fieldValue === undefined || fieldValue === null || fieldValue === '';
    
    switch (operator) {
      case 'is_empty':
        return isEmpty;
      
      case 'is_not_empty':
        return !isEmpty;
      
      case 'equals':
        if (fieldType === 'checkbox' && Array.isArray(fieldValue)) {
          return fieldValue.includes(expectedValue);
        }
        return this.normalizeValue(fieldValue) === this.normalizeValue(expectedValue);
      
      case 'not_equals':
        if (fieldType === 'checkbox' && Array.isArray(fieldValue)) {
          return !fieldValue.includes(expectedValue);
        }
        return this.normalizeValue(fieldValue) !== this.normalizeValue(expectedValue);
      
      case 'contains':
        if (isEmpty) return false;
        const fieldStr = String(fieldValue).toLowerCase();
        const expectedStr = String(expectedValue).toLowerCase();
        return fieldStr.includes(expectedStr);
      
      case 'not_contains':
        if (isEmpty) return true;
        const fieldStr2 = String(fieldValue).toLowerCase();
        const expectedStr2 = String(expectedValue).toLowerCase();
        return !fieldStr2.includes(expectedStr2);
      
      case 'greater_than':
        if (isEmpty) return false;
        const numField = this.parseNumber(fieldValue);
        const numExpected = this.parseNumber(expectedValue);
        return numField !== null && numExpected !== null && numField > numExpected;
      
      case 'less_than':
        if (isEmpty) return false;
        const numField2 = this.parseNumber(fieldValue);
        const numExpected2 = this.parseNumber(expectedValue);
        return numField2 !== null && numExpected2 !== null && numField2 < numExpected2;
      
      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Normalize values for comparison
   * @param value - Value to normalize
   * @returns Normalized value
   */
  static normalizeValue(value: any): any {
    if (value === undefined || value === null) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    
    return value;
  }

  /**
   * Parse number from various input types
   * @param value - Value to parse as number
   * @returns Parsed number or null if invalid
   */
  static parseNumber(value: any): number | null {
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    
    if (typeof value === 'string') {
      const parsed = parseFloat(value.trim());
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  }

  /**
   * Get human-readable reason for logic result
   * @param field - Form field
   * @param responses - User responses
   * @param isVisible - Whether field is visible
   * @param skipTarget - Skip target field ID
   * @returns Human-readable reason string
   */
  static getLogicReason(
    field: IFormField, 
    responses: Record<string, any>, 
    isVisible: boolean, 
    skipTarget: string | null
  ): string {
    const reasons: string[] = [];

    if (!isVisible && field.conditional?.show?.enabled) {
      reasons.push('Hidden by show conditions');
    }

    if (skipTarget && field.conditional?.skip?.enabled) {
      reasons.push(`Skip to field ${skipTarget}`);
    }

    if (reasons.length === 0) {
      return isVisible ? 'Visible by default' : 'Hidden by default';
    }

    return reasons.join(', ');
  }

  /**
   * Get fields that should be shown next based on current responses
   * @param fields - All form fields
   * @param responses - Current user responses
   * @param currentFieldId - Current field being processed
   * @returns Array of next visible field IDs
   */
  static getNextVisibleFields(
    fields: IFormField[], 
    responses: Record<string, any>, 
    currentFieldId: string
  ): string[] {
    const currentIndex = fields.findIndex(f => f.id === currentFieldId);
    if (currentIndex === -1) return [];

    const currentField = fields[currentIndex];
    const skipTarget = this.evaluateSkipLogic(currentField, responses, fields);

    if (skipTarget) {
      // Skip to target field
      const targetIndex = fields.findIndex(f => f.id === skipTarget);
      if (targetIndex !== -1) {
        const targetField = fields[targetIndex];
        const isTargetVisible = this.evaluateFieldVisibility(targetField, responses, fields);
        return isTargetVisible ? [skipTarget] : this.getNextVisibleFields(fields, responses, skipTarget);
      }
    }

    // Find next visible field in sequence
    for (let i = currentIndex + 1; i < fields.length; i++) {
      const nextField = fields[i];
      const isVisible = this.evaluateFieldVisibility(nextField, responses, fields);
      if (isVisible) {
        return [nextField.id];
      }
    }

    return []; // No more fields
  }

  /**
   * Validate conditional logic configuration
   * @param fields - Form fields to validate
   * @returns Validation result with errors
   */
  static validateConditionalLogic(fields: IFormField[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIds = new Set(fields.map(f => f.id));

    fields.forEach((field, index) => {
      const { conditional } = field;
      if (!conditional) return;

      // Validate show conditions
      if (conditional.show?.enabled && conditional.show.conditions) {
        conditional.show.conditions.forEach((condition, condIndex) => {
          if (!fieldIds.has(condition.fieldId)) {
            errors.push(`Field ${field.id}: Show condition ${condIndex + 1} references non-existent field ${condition.fieldId}`);
          }
          
          // Check for self-reference
          if (condition.fieldId === field.id) {
            errors.push(`Field ${field.id}: Show condition ${condIndex + 1} cannot reference itself`);
          }
          
          // Check for forward reference (field that comes after current field)
          const referencedFieldIndex = fields.findIndex(f => f.id === condition.fieldId);
          if (referencedFieldIndex > index) {
            warnings.push(`Field ${field.id}: Show condition ${condIndex + 1} references a field that comes later in the form (${condition.fieldId})`);
          }
        });
      }

      // Validate skip conditions
      if (conditional.skip?.enabled && conditional.skip.conditions) {
        conditional.skip.conditions.forEach((condition, condIndex) => {
          if (!fieldIds.has(condition.fieldId)) {
            errors.push(`Field ${field.id}: Skip condition ${condIndex + 1} references non-existent field ${condition.fieldId}`);
          }
        });

        // Validate skip target
        if (conditional.skip.targetFieldId && !fieldIds.has(conditional.skip.targetFieldId)) {
          errors.push(`Field ${field.id}: Skip target ${conditional.skip.targetFieldId} does not exist`);
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
   * Simulate form flow based on hypothetical responses
   * @param fields - Form fields
   * @param responses - Hypothetical responses
   * @returns Simulation result with flow path
   */
  static simulateFormFlow(fields: IFormField[], responses: Record<string, any>): {
    flowPath: string[];
    visibleFields: string[];
    hiddenFields: string[];
    skipActions: Array<{ from: string; to: string; reason: string }>;
  } {
    const result = this.evaluateFormLogic(fields, responses);
    const flowPath: string[] = [];
    const skipActions: Array<{ from: string; to: string; reason: string }> = [];

    let currentIndex = 0;
    while (currentIndex < fields.length) {
      const currentField = fields[currentIndex];
      
      if (result.visibleFields.has(currentField.id)) {
        flowPath.push(currentField.id);
        
        const skipTarget = result.skipTargets.get(currentField.id);
        if (skipTarget) {
          const targetIndex = fields.findIndex(f => f.id === skipTarget);
          if (targetIndex !== -1) {
            skipActions.push({
              from: currentField.id,
              to: skipTarget,
              reason: `Skip condition met`
            });
            currentIndex = targetIndex;
            continue;
          }
        }
      }
      
      currentIndex++;
    }

    return {
      flowPath,
      visibleFields: Array.from(result.visibleFields),
      hiddenFields: Array.from(result.hiddenFields),
      skipActions
    };
  }
}

export default ConditionalLogicService;