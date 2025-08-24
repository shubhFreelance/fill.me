import { IFormField, ICalculation } from '../types';

/**
 * Calculator Service
 * Handles mathematical calculations and formulas in forms
 */
export class CalculatorService {

  /**
   * Process calculations for all form fields
   * @param fields - Array of form fields
   * @param responses - Current user responses
   * @returns Object with calculated values for fields
   */
  static processCalculations(fields: IFormField[], responses: Record<string, any>): Record<string, any> {
    const calculatedValues: Record<string, any> = {};
    const calculationContext: Record<string, number> = {};

    // First, extract all numeric values for calculations
    fields.forEach(field => {
      const value = responses[field.id];
      if (value !== undefined && value !== null && value !== '') {
        const numericValue = this.parseNumericValue(value, field.type);
        if (numericValue !== null) {
          calculationContext[field.id] = numericValue;
        }
      }
    });

    // Process calculations in dependency order
    const processedFields = new Set<string>();
    let maxIterations = fields.length * 2; // Prevent infinite loops
    
    while (processedFields.size < fields.filter(f => f.calculation?.enabled).length && maxIterations > 0) {
      fields.forEach(field => {
        if (field.calculation?.enabled && !processedFields.has(field.id)) {
          const canCalculate = this.canCalculateField(field, calculationContext, processedFields);
          
          if (canCalculate) {
            const calculatedValue = this.calculateFieldValue(field, calculationContext, responses);
            if (calculatedValue !== null) {
              calculatedValues[field.id] = this.formatCalculatedValue(calculatedValue, field.calculation!);
              calculationContext[field.id] = calculatedValue;
              processedFields.add(field.id);
            }
          }
        }
      });
      maxIterations--;
    }

    return calculatedValues;
  }

  /**
   * Calculate value for a specific field
   * @param field - Target field with calculation configuration
   * @param calculationContext - Available numeric values
   * @param responses - All form responses
   * @returns Calculated numeric value
   */
  static calculateFieldValue(
    field: IFormField,
    calculationContext: Record<string, number>,
    responses: Record<string, any>
  ): number | null {
    const { calculation } = field;
    if (!calculation?.enabled || !calculation.formula) return null;

    try {
      // Replace field references in formula with actual values
      let processedFormula = calculation.formula;
      
      // Handle field references like {{fieldId}}
      const fieldReferences = processedFormula.match(/\{\{([^}]+)\}\}/g);
      if (fieldReferences) {
        fieldReferences.forEach(reference => {
          const fieldId = reference.replace(/\{\{|\}\}/g, '').trim();
          const value = calculationContext[fieldId];
          if (value !== undefined) {
            processedFormula = processedFormula.replace(reference, value.toString());
          } else {
            processedFormula = processedFormula.replace(reference, '0');
          }
        });
      }

      // Process built-in functions
      processedFormula = this.processCalculationFunctions(processedFormula, calculationContext);

      // Evaluate the mathematical expression safely
      const result = this.evaluateExpression(processedFormula);
      
      return result;
    } catch (error) {
      console.error(`Calculation error for field ${field.id}:`, error);
      return null;
    }
  }

  /**
   * Check if a field can be calculated (all dependencies are available)
   * @param field - Field to check
   * @param calculationContext - Available values
   * @param processedFields - Already processed fields
   * @returns Whether field can be calculated
   */
  static canCalculateField(
    field: IFormField,
    calculationContext: Record<string, number>,
    processedFields: Set<string>
  ): boolean {
    const { calculation } = field;
    if (!calculation?.enabled || !calculation.dependencies) return false;

    // Check if all dependencies are available
    return calculation.dependencies.every(depFieldId => {
      return calculationContext[depFieldId] !== undefined || processedFields.has(depFieldId);
    });
  }

  /**
   * Parse numeric value from various field types
   * @param value - Field value
   * @param fieldType - Type of the field
   * @returns Parsed numeric value or null
   */
  static parseNumericValue(value: any, fieldType: string): number | null {
    switch (fieldType) {
      case 'number':
        return this.parseNumber(value);
      
      case 'rating':
      case 'scale':
        return this.parseNumber(value);
      
      case 'checkbox':
        // Count selected options
        if (Array.isArray(value)) {
          return value.length;
        }
        return value ? 1 : 0;
      
      case 'radio':
      case 'dropdown':
        // Try to parse as number, otherwise return 1 if selected
        const numValue = this.parseNumber(value);
        return numValue !== null ? numValue : (value ? 1 : 0);
      
      case 'text':
      case 'textarea':
        // Try to extract number from text
        const textNum = this.parseNumber(value);
        return textNum !== null ? textNum : (value ? String(value).length : 0);
      
      default:
        return this.parseNumber(value);
    }
  }

  /**
   * Process calculation functions in formula
   * @param formula - Formula string
   * @param context - Calculation context
   * @returns Processed formula
   */
  static processCalculationFunctions(formula: string, context: Record<string, number>): string {
    let processedFormula = formula;

    // Function: SUM(field1, field2, ...)
    processedFormula = processedFormula.replace(
      /SUM\(([^)]+)\)/gi,
      (match, fieldList) => {
        const fieldIds = fieldList.split(',').map((id: string) => id.trim());
        const sum = fieldIds.reduce((total: number, fieldId: string) => {
          const value = context[fieldId] || 0;
          return total + value;
        }, 0);
        return sum.toString();
      }
    );

    // Function: AVG(field1, field2, ...)
    processedFormula = processedFormula.replace(
      /AVG\(([^)]+)\)/gi,
      (match, fieldList) => {
        const fieldIds = fieldList.split(',').map((id: string) => id.trim());
        const values = fieldIds.map((fieldId: string) => context[fieldId] || 0);
        const avg = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0;
        return avg.toString();
      }
    );

    // Function: MIN(field1, field2, ...)
    processedFormula = processedFormula.replace(
      /MIN\(([^)]+)\)/gi,
      (match, fieldList) => {
        const fieldIds = fieldList.split(',').map((id: string) => id.trim());
        const values = fieldIds.map((fieldId: string) => context[fieldId] || 0);
        const min = values.length > 0 ? Math.min(...values) : 0;
        return min.toString();
      }
    );

    // Function: MAX(field1, field2, ...)
    processedFormula = processedFormula.replace(
      /MAX\(([^)]+)\)/gi,
      (match, fieldList) => {
        const fieldIds = fieldList.split(',').map((id: string) => id.trim());
        const values = fieldIds.map((fieldId: string) => context[fieldId] || 0);
        const max = values.length > 0 ? Math.max(...values) : 0;
        return max.toString();
      }
    );

    // Function: COUNT(field1, field2, ...)
    processedFormula = processedFormula.replace(
      /COUNT\(([^)]+)\)/gi,
      (match, fieldList) => {
        const fieldIds = fieldList.split(',').map((id: string) => id.trim());
        const count = fieldIds.filter((fieldId: string) => context[fieldId] !== undefined).length;
        return count.toString();
      }
    );

    // Function: IF(condition, trueValue, falseValue)
    processedFormula = processedFormula.replace(
      /IF\(([^,]+),([^,]+),([^)]+)\)/gi,
      (match, condition, trueValue, falseValue) => {
        try {
          const conditionResult = this.evaluateExpression(condition.trim());
          return conditionResult ? trueValue.trim() : falseValue.trim();
        } catch {
          return falseValue.trim();
        }
      }
    );

    // Mathematical functions
    processedFormula = processedFormula.replace(/SQRT\(([^)]+)\)/gi, (match, value) => {
      const num = parseFloat(value);
      return isNaN(num) ? '0' : Math.sqrt(num).toString();
    });

    processedFormula = processedFormula.replace(/ABS\(([^)]+)\)/gi, (match, value) => {
      const num = parseFloat(value);
      return isNaN(num) ? '0' : Math.abs(num).toString();
    });

    processedFormula = processedFormula.replace(/ROUND\(([^,]+),([^)]+)\)/gi, (match, value, decimals) => {
      const num = parseFloat(value);
      const dec = parseInt(decimals) || 0;
      return isNaN(num) ? '0' : num.toFixed(dec);
    });

    return processedFormula;
  }

  /**
   * Safely evaluate mathematical expression
   * @param expression - Mathematical expression string
   * @returns Calculated result
   */
  static evaluateExpression(expression: string): number {
    // Remove any non-mathematical characters for security
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    
    // Basic validation
    if (!sanitized || sanitized.trim() === '') {
      return 0;
    }

    try {
      // Use Function constructor for safer evaluation than eval
      const result = new Function(`return ${sanitized}`)();
      
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return result;
      }
      
      return 0;
    } catch (error) {
      console.error('Expression evaluation error:', error);
      return 0;
    }
  }

  /**
   * Format calculated value based on display type
   * @param value - Calculated numeric value
   * @param calculation - Calculation configuration
   * @returns Formatted value
   */
  static formatCalculatedValue(value: number, calculation: ICalculation): string | number {
    const { displayType } = calculation;

    switch (displayType) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      
      case 'percentage':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value / 100);
      
      case 'decimal':
        return parseFloat(value.toFixed(2));
      
      case 'number':
      default:
        return Math.round(value);
    }
  }

  /**
   * Get calculation dependencies for a field
   * @param field - Field to analyze
   * @returns Array of field IDs this calculation depends on
   */
  static getCalculationDependencies(field: IFormField): string[] {
    const { calculation } = field;
    if (!calculation?.enabled || !calculation.formula) return [];

    const dependencies = new Set<string>();

    // Add explicitly defined dependencies
    if (calculation.dependencies) {
      calculation.dependencies.forEach(dep => dependencies.add(dep));
    }

    // Extract dependencies from formula
    const fieldReferences = calculation.formula.match(/\{\{([^}]+)\}\}/g);
    if (fieldReferences) {
      fieldReferences.forEach(reference => {
        const fieldId = reference.replace(/\{\{|\}\}/g, '').trim();
        dependencies.add(fieldId);
      });
    }

    // Extract from function calls
    const functionMatches = calculation.formula.match(/(SUM|AVG|MIN|MAX|COUNT)\(([^)]+)\)/gi);
    if (functionMatches) {
      functionMatches.forEach(match => {
        const fieldList = match.replace(/(SUM|AVG|MIN|MAX|COUNT)\(|\)/gi, '');
        const fieldIds = fieldList.split(',').map(id => id.trim());
        fieldIds.forEach(fieldId => dependencies.add(fieldId));
      });
    }

    return Array.from(dependencies);
  }

  /**
   * Validate calculation configuration
   * @param fields - Form fields to validate
   * @returns Validation result
   */
  static validateCalculations(fields: IFormField[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIds = new Set(fields.map(f => f.id));

    fields.forEach(field => {
      if (!field.calculation?.enabled) return;

      const { calculation } = field;

      // Validate formula exists
      if (!calculation.formula) {
        errors.push(`Field ${field.id}: Calculation is enabled but no formula is provided`);
        return;
      }

      // Validate dependencies
      if (calculation.dependencies) {
        calculation.dependencies.forEach(depFieldId => {
          if (!fieldIds.has(depFieldId)) {
            errors.push(`Field ${field.id}: Calculation depends on non-existent field ${depFieldId}`);
          }
        });
      }

      // Check for circular dependencies
      const dependencies = this.getCalculationDependencies(field);
      if (dependencies.includes(field.id)) {
        errors.push(`Field ${field.id}: Calculation cannot reference itself`);
      }

      // Validate formula syntax
      try {
        // Test formula with dummy values
        const testContext: Record<string, number> = {};
        dependencies.forEach(depId => {
          testContext[depId] = 1;
        });
        
        this.calculateFieldValue(field, testContext, {});
      } catch (error) {
        warnings.push(`Field ${field.id}: Formula may have syntax issues - ${error}`);
      }

      // Check display type
      if (!['currency', 'percentage', 'number', 'decimal'].includes(calculation.displayType)) {
        warnings.push(`Field ${field.id}: Invalid display type ${calculation.displayType}`);
      }
    });

    // Check for circular dependency chains
    const circularDeps = this.detectCircularDependencies(fields);
    if (circularDeps.length > 0) {
      errors.push(`Circular dependency detected in fields: ${circularDeps.join(' -> ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Detect circular dependencies in calculations
   * @param fields - Form fields
   * @returns Array of field IDs in circular dependency chain
   */
  static detectCircularDependencies(fields: IFormField[]): string[] {
    const graph = new Map<string, string[]>();
    
    // Build dependency graph
    fields.forEach(field => {
      if (field.calculation?.enabled) {
        const dependencies = this.getCalculationDependencies(field);
        graph.set(field.id, dependencies);
      }
    });

    // DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (node: string, path: string[]): string[] | null => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        return path.slice(cycleStart).concat(node);
      }
      
      if (visited.has(node)) return null;
      
      visited.add(node);
      recursionStack.add(node);
      
      const dependencies = graph.get(node) || [];
      for (const dep of dependencies) {
        const cycle = hasCycle(dep, [...path, node]);
        if (cycle) return cycle;
      }
      
      recursionStack.delete(node);
      return null;
    };

    for (const [fieldId] of graph) {
      if (!visited.has(fieldId)) {
        const cycle = hasCycle(fieldId, []);
        if (cycle) return cycle;
      }
    }

    return [];
  }

  // Helper methods

  private static parseNumber(value: any): number | null {
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  }
}

export default CalculatorService;