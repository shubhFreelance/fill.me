import mongoose from 'mongoose';
import Form from '../../models/Form';
import User from '../../models/User';
import { CalculationService } from '../../services/CalculationService';
import { TestUtils } from '../setup';
import { IFormField, FormFieldType } from '../../types';

describe('CalculationService', () => {
  let testUser: any;
  let testForm: any;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Form.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    testUser = await User.create(userData);

    // Create test form with calculation fields
    const formData = TestUtils.createTestForm(testUser._id.toString());
    formData.fields = [
      {
        id: 'quantity',
        type: 'number',
        label: 'Quantity',
        placeholder: 'Enter quantity',
        required: true,
        order: 0,
        options: [],
        validation: { min: 1, max: 1000 },
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'price',
        type: 'number',
        label: 'Unit Price',
        placeholder: 'Enter price',
        required: true,
        order: 1,
        options: [],
        validation: { min: 0.01, max: 10000 },
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'subtotal',
        type: 'calculated',
        label: 'Subtotal',
        placeholder: '',
        required: false,
        order: 2,
        options: [],
        validation: {},
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: {
          enabled: true,
          formula: '{{quantity}} * {{price}}',
          dependencies: ['quantity', 'price'],
          displayType: 'currency'
        },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'tax_rate',
        type: 'number',
        label: 'Tax Rate (%)',
        placeholder: 'Enter tax rate',
        required: false,
        order: 3,
        options: [],
        validation: { min: 0, max: 100 },
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: { defaultValue: '10' }
      },
      {
        id: 'tax_amount',
        type: 'calculated',
        label: 'Tax Amount',
        placeholder: '',
        required: false,
        order: 4,
        options: [],
        validation: {},
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: {
          enabled: true,
          formula: '{{subtotal}} * ({{tax_rate}} / 100)',
          dependencies: ['subtotal', 'tax_rate'],
          displayType: 'currency'
        },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'total',
        type: 'calculated',
        label: 'Total Amount',
        placeholder: '',
        required: false,
        order: 5,
        options: [],
        validation: {},
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: {
          enabled: true,
          formula: '{{subtotal}} + {{tax_amount}}',
          dependencies: ['subtotal', 'tax_amount'],
          displayType: 'currency'
        },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'discount_percentage',
        type: 'number',
        label: 'Discount (%)',
        placeholder: 'Enter discount',
        required: false,
        order: 6,
        options: [],
        validation: { min: 0, max: 100 },
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: { enabled: false, dependencies: [], displayType: 'number' },
        prefill: { enabled: false },
        properties: {}
      },
      {
        id: 'final_total',
        type: 'calculated',
        label: 'Final Total',
        placeholder: '',
        required: false,
        order: 7,
        options: [],
        validation: {},
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: {
          enabled: true,
          formula: 'IF({{discount_percentage}} > 0, {{total}} * (1 - {{discount_percentage}} / 100), {{total}})',
          dependencies: ['total', 'discount_percentage'],
          displayType: 'currency'
        },
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

  describe('calculateField', () => {
    it('should calculate simple multiplication formula', async () => {
      const responses = new Map([
        ['quantity', '5'],
        ['price', '10.50']
      ]);

      const result = await CalculationService.calculateField(
        testForm._id.toString(),
        'subtotal',
        responses
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe('52.50');
      expect(result.displayValue).toBe('$52.50');
      expect(result.dependencies).toEqual(['quantity', 'price']);
    });

    it('should calculate tax amount with percentage', async () => {
      const responses = new Map([
        ['quantity', '5'],
        ['price', '10.50'],
        ['subtotal', '52.50'],
        ['tax_rate', '8.5']
      ]);

      const result = await CalculationService.calculateField(
        testForm._id.toString(),
        'tax_amount',
        responses
      );

      expect(result.success).toBe(true);
      expect(parseFloat(result.value!)).toBeCloseTo(4.46, 2);
      expect(result.displayValue).toContain('$4.46');
    });

    it('should calculate nested dependencies', async () => {
      const responses = new Map([
        ['quantity', '3'],
        ['price', '25.00'],
        ['subtotal', '75.00'],
        ['tax_rate', '10'],
        ['tax_amount', '7.50']
      ]);

      const result = await CalculationService.calculateField(
        testForm._id.toString(),
        'total',
        responses
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe('82.50');
      expect(result.displayValue).toBe('$82.50');
    });

    it('should handle IF statement in formula', async () => {
      const responses = new Map([
        ['total', '82.50'],
        ['discount_percentage', '15']
      ]);

      const result = await CalculationService.calculateField(
        testForm._id.toString(),
        'final_total',
        responses
      );

      expect(result.success).toBe(true);
      expect(parseFloat(result.value!)).toBeCloseTo(70.125, 2);
      expect(result.displayValue).toContain('$70.13');
    });

    it('should handle IF statement with no discount', async () => {
      const responses = new Map([
        ['total', '82.50'],
        ['discount_percentage', '0']
      ]);

      const result = await CalculationService.calculateField(
        testForm._id.toString(),
        'final_total',
        responses
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe('82.50');
      expect(result.displayValue).toBe('$82.50');
    });

    it('should return error for missing dependencies', async () => {
      const responses = new Map([
        ['quantity', '5']
        // Missing price
      ]);

      const result = await CalculationService.calculateField(
        testForm._id.toString(),
        'subtotal',
        responses
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field values');
      expect(result.missingFields).toEqual(['price']);
    });

    it('should return error for non-existent field', async () => {
      const responses = new Map();

      const result = await CalculationService.calculateField(
        testForm._id.toString(),
        'non-existent-field',
        responses
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Calculation field not found');
    });

    it('should return error for field without calculation', async () => {
      const responses = new Map();

      const result = await CalculationService.calculateField(
        testForm._id.toString(),
        'quantity', // Regular field, not calculated
        responses
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Field is not a calculation field');
    });

    it('should handle division by zero gracefully', async () => {
      // Add a division field
      testForm.fields.push({
        id: 'division_test',
        type: 'calculated',
        label: 'Division Test',
        placeholder: '',
        required: false,
        order: 8,
        options: [],
        validation: {},
        conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
        answerRecall: { enabled: false },
        calculation: {
          enabled: true,
          formula: '{{quantity}} / {{price}}',
          dependencies: ['quantity', 'price'],
          displayType: 'number'
        },
        prefill: { enabled: false },
        properties: {}
      });
      await testForm.save();

      const responses = new Map([
        ['quantity', '10'],
        ['price', '0']
      ]);

      const result = await CalculationService.calculateField(
        testForm._id.toString(),
        'division_test',
        responses
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Division by zero');
    });
  });

  describe('calculateAllFields', () => {
    it('should calculate all fields in correct dependency order', async () => {
      const responses = new Map([
        ['quantity', '4'],
        ['price', '12.75'],
        ['tax_rate', '8.25'],
        ['discount_percentage', '10']
      ]);

      const result = await CalculationService.calculateAllFields(
        testForm._id.toString(),
        responses
      );

      expect(result.success).toBe(true);
      expect(result.calculations).toHaveProperty('subtotal');
      expect(result.calculations).toHaveProperty('tax_amount');
      expect(result.calculations).toHaveProperty('total');
      expect(result.calculations).toHaveProperty('final_total');

      // Verify calculation order and values
      expect(result.calculations.subtotal.value).toBe('51.00');
      expect(parseFloat(result.calculations.tax_amount.value!)).toBeCloseTo(4.21, 2);
      expect(parseFloat(result.calculations.total.value!)).toBeCloseTo(55.21, 2);
      expect(parseFloat(result.calculations.final_total.value!)).toBeCloseTo(49.69, 2);
    });

    it('should handle partial calculations when some dependencies are missing', async () => {
      const responses = new Map([
        ['quantity', '3'],
        ['price', '15.00']
        // Missing tax_rate and discount_percentage
      ]);

      const result = await CalculationService.calculateAllFields(
        testForm._id.toString(),
        responses
      );

      expect(result.success).toBe(true);
      expect(result.calculations).toHaveProperty('subtotal');
      expect(result.calculations.subtotal.success).toBe(true);
      expect(result.calculations.subtotal.value).toBe('45.00');

      // Tax amount should fail due to missing tax_rate
      expect(result.calculations).toHaveProperty('tax_amount');
      expect(result.calculations.tax_amount.success).toBe(false);
    });

    it('should return empty object for form with no calculation fields', async () => {
      // Create form without calculation fields
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

      const responses = new Map([['name', 'John Doe']]);

      const result = await CalculationService.calculateAllFields(
        simpleForm._id.toString(),
        responses
      );

      expect(result.success).toBe(true);
      expect(Object.keys(result.calculations)).toHaveLength(0);
    });
  });

  describe('parseFormula', () => {
    it('should parse simple arithmetic formula', () => {
      const formula = '{{quantity}} * {{price}}';
      const values = { quantity: 5, price: 10.50 };

      const result = CalculationService.parseFormula(formula, values);

      expect(result.success).toBe(true);
      expect(result.parsedFormula).toBe('5 * 10.5');
      expect(result.dependencies).toEqual(['quantity', 'price']);
    });

    it('should parse complex formula with multiple operations', () => {
      const formula = '({{a}} + {{b}}) * {{c}} - {{d}} / 2';
      const values = { a: 10, b: 5, c: 3, d: 8 };

      const result = CalculationService.parseFormula(formula, values);

      expect(result.success).toBe(true);
      expect(result.parsedFormula).toBe('(10 + 5) * 3 - 8 / 2');
      expect(result.dependencies).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should parse IF statement', () => {
      const formula = 'IF({{discount}} > 0, {{total}} * (1 - {{discount}}/100), {{total}})';
      const values = { discount: 10, total: 100 };

      const result = CalculationService.parseFormula(formula, values);

      expect(result.success).toBe(true);
      expect(result.dependencies).toEqual(['discount', 'total']);
    });

    it('should handle missing field values', () => {
      const formula = '{{quantity}} * {{price}}';
      const values = { quantity: 5 }; // Missing price

      const result = CalculationService.parseFormula(formula, values);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing field values');
      expect(result.missingFields).toEqual(['price']);
    });

    it('should detect invalid formula syntax', () => {
      const formula = '{{quantity}} * * {{price}}'; // Invalid syntax
      const values = { quantity: 5, price: 10 };

      const result = CalculationService.parseFormula(formula, values);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid formula syntax');
    });

    it('should handle formulas with no field references', () => {
      const formula = '10 + 5 * 2';
      const values = {};

      const result = CalculationService.parseFormula(formula, values);

      expect(result.success).toBe(true);
      expect(result.parsedFormula).toBe('10 + 5 * 2');
      expect(result.dependencies).toEqual([]);
    });
  });

  describe('evaluateFormula', () => {
    it('should evaluate basic arithmetic operations', () => {
      const expressions = [
        { formula: '5 + 3', expected: 8 },
        { formula: '10 - 4', expected: 6 },
        { formula: '6 * 7', expected: 42 },
        { formula: '20 / 4', expected: 5 },
        { formula: '2 ^ 3', expected: 8 }
      ];

      expressions.forEach(({ formula, expected }) => {
        const result = CalculationService.evaluateFormula(formula);
        expect(result.success).toBe(true);
        expect(result.result).toBe(expected);
      });
    });

    it('should evaluate complex expressions with parentheses', () => {
      const formula = '(10 + 5) * 2 - 8 / 4';
      const result = CalculationService.evaluateFormula(formula);

      expect(result.success).toBe(true);
      expect(result.result).toBe(28); // (15 * 2) - 2 = 30 - 2 = 28
    });

    it('should evaluate IF statements', () => {
      const testCases = [
        { formula: 'IF(true, 10, 5)', expected: 10 },
        { formula: 'IF(false, 10, 5)', expected: 5 },
        { formula: 'IF(5 > 3, 100, 50)', expected: 100 },
        { formula: 'IF(2 < 1, 100, 50)', expected: 50 }
      ];

      testCases.forEach(({ formula, expected }) => {
        const result = CalculationService.evaluateFormula(formula);
        expect(result.success).toBe(true);
        expect(result.result).toBe(expected);
      });
    });

    it('should handle comparison operators', () => {
      const testCases = [
        { formula: '5 > 3', expected: true },
        { formula: '2 < 1', expected: false },
        { formula: '5 >= 5', expected: true },
        { formula: '3 <= 2', expected: false },
        { formula: '5 == 5', expected: true },
        { formula: '5 != 3', expected: true }
      ];

      testCases.forEach(({ formula, expected }) => {
        const result = CalculationService.evaluateFormula(formula);
        expect(result.success).toBe(true);
        expect(result.result).toBe(expected);
      });
    });

    it('should handle mathematical functions', () => {
      const testCases = [
        { formula: 'ROUND(3.7)', expected: 4 },
        { formula: 'ROUND(3.2)', expected: 3 },
        { formula: 'FLOOR(3.7)', expected: 3 },
        { formula: 'CEIL(3.2)', expected: 4 },
        { formula: 'ABS(-5)', expected: 5 },
        { formula: 'MAX(5, 10, 3)', expected: 10 },
        { formula: 'MIN(5, 10, 3)', expected: 3 }
      ];

      testCases.forEach(({ formula, expected }) => {
        const result = CalculationService.evaluateFormula(formula);
        expect(result.success).toBe(true);
        expect(result.result).toBe(expected);
      });
    });

    it('should return error for division by zero', () => {
      const result = CalculationService.evaluateFormula('10 / 0');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Division by zero');
    });

    it('should return error for invalid syntax', () => {
      const result = CalculationService.evaluateFormula('5 + + 3');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid formula syntax');
    });
  });

  describe('formatDisplayValue', () => {
    it('should format currency values', () => {
      const testCases = [
        { value: 123.45, type: 'currency', expected: '$123.45' },
        { value: 1000, type: 'currency', expected: '$1,000.00' },
        { value: 0.99, type: 'currency', expected: '$0.99' }
      ];

      testCases.forEach(({ value, type, expected }) => {
        const result = CalculationService.formatDisplayValue(value, type as any);
        expect(result).toBe(expected);
      });
    });

    it('should format percentage values', () => {
      const testCases = [
        { value: 0.15, type: 'percentage', expected: '15%' },
        { value: 0.0825, type: 'percentage', expected: '8.25%' },
        { value: 1, type: 'percentage', expected: '100%' }
      ];

      testCases.forEach(({ value, type, expected }) => {
        const result = CalculationService.formatDisplayValue(value, type as any);
        expect(result).toBe(expected);
      });
    });

    it('should format number values', () => {
      const testCases = [
        { value: 123.456, type: 'number', expected: '123.46' },
        { value: 1000, type: 'number', expected: '1,000' },
        { value: 0.1, type: 'number', expected: '0.1' }
      ];

      testCases.forEach(({ value, type, expected }) => {
        const result = CalculationService.formatDisplayValue(value, type as any);
        expect(result).toBe(expected);
      });
    });

    it('should handle decimal places correctly', () => {
      const result1 = CalculationService.formatDisplayValue(123.456789, 'number', 3);
      const result2 = CalculationService.formatDisplayValue(123.456789, 'currency', 3);

      expect(result1).toBe('123.457');
      expect(result2).toBe('$123.457');
    });
  });

  describe('getDependencyOrder', () => {
    it('should return calculation fields in correct dependency order', async () => {
      const order = await CalculationService.getDependencyOrder(testForm._id.toString());

      expect(order.success).toBe(true);
      expect(order.order).toEqual(['subtotal', 'tax_amount', 'total', 'final_total']);
      expect(order.dependencyGraph).toBeDefined();
    });

    it('should detect circular dependencies', async () => {
      // Create form with circular dependency
      const circularForm = await Form.create({
        ...TestUtils.createTestForm(testUser._id.toString()),
        publicUrl: 'circular-form-' + Date.now(),
        fields: [
          {
            id: 'field_a',
            type: 'calculated',
            label: 'Field A',
            required: false,
            order: 0,
            options: [],
            validation: {},
            conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
            answerRecall: { enabled: false },
            calculation: {
              enabled: true,
              formula: '{{field_b}} + 1',
              dependencies: ['field_b'],
              displayType: 'number'
            },
            prefill: { enabled: false },
            properties: {}
          },
          {
            id: 'field_b',
            type: 'calculated',
            label: 'Field B',
            required: false,
            order: 1,
            options: [],
            validation: {},
            conditional: { show: { enabled: false, conditions: [] }, skip: { enabled: false, conditions: [] } },
            answerRecall: { enabled: false },
            calculation: {
              enabled: true,
              formula: '{{field_a}} * 2',
              dependencies: ['field_a'],
              displayType: 'number'
            },
            prefill: { enabled: false },
            properties: {}
          }
        ]
      });

      const order = await CalculationService.getDependencyOrder(circularForm._id.toString());

      expect(order.success).toBe(false);
      expect(order.error).toContain('Circular dependency detected');
    });

    it('should handle form with no calculation fields', async () => {
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

      const order = await CalculationService.getDependencyOrder(simpleForm._id.toString());

      expect(order.success).toBe(true);
      expect(order.order).toEqual([]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid ObjectId format', async () => {
      const responses = new Map();

      await expect(
        CalculationService.calculateField('invalid-id', 'subtotal', responses)
      ).rejects.toThrow();
    });

    it('should handle non-existent form', async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId().toString();
      const responses = new Map();

      const result = await CalculationService.calculateField(nonExistentFormId, 'subtotal', responses);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Form not found');
    });

    it('should handle very large numbers', () => {
      const formula = '999999999 * 999999999';
      const result = CalculationService.evaluateFormula(formula);

      expect(result.success).toBe(true);
      expect(typeof result.result).toBe('number');
    });

    it('should handle decimal precision issues', () => {
      const formula = '0.1 + 0.2';
      const result = CalculationService.evaluateFormula(formula);

      expect(result.success).toBe(true);
      // Handle floating point precision
      expect(Math.abs(result.result! - 0.3)).toBeLessThan(0.000001);
    });

    it('should sanitize formula input', () => {
      const maliciousFormula = 'eval("console.log(\'hack\')")';
      const result = CalculationService.evaluateFormula(maliciousFormula);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid formula syntax');
    });
  });
});