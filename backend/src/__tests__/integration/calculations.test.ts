import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import Form from '../../models/Form';
import { TestUtils } from '../setup';

describe('Calculations API Integration Tests', () => {
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

    // Create test form with calculation fields
    const formData = TestUtils.createTestForm(testUser._id.toString());
    formData.fields = [
      {
        id: 'quantity',
        type: 'number',
        label: 'Quantity',
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
      }
    ];
    testForm = await Form.create(formData);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Form.deleteMany({});
  });

  describe('POST /api/forms/:formId/calculations/calculate', () => {
    it('should calculate all fields based on responses', async () => {
      const responses = {
        quantity: '5',
        price: '10.50',
        tax_rate: '8.5'
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.calculations).toBeDefined();
      expect(response.body.calculations).toHaveProperty('subtotal');
      expect(response.body.calculations).toHaveProperty('tax_amount');
      expect(response.body.calculations).toHaveProperty('total');

      // Verify calculations
      expect(response.body.calculations.subtotal.value).toBe('52.50');
      expect(response.body.calculations.subtotal.displayValue).toBe('$52.50');
      expect(parseFloat(response.body.calculations.tax_amount.value)).toBeCloseTo(4.46, 2);
      expect(parseFloat(response.body.calculations.total.value)).toBeCloseTo(56.96, 2);
    });

    it('should handle partial calculations when dependencies are missing', async () => {
      const responses = {
        quantity: '3',
        price: '15.00'
        // Missing tax_rate
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses })
        .expect(200);

      expect(response.body.calculations.subtotal.success).toBe(true);
      expect(response.body.calculations.subtotal.value).toBe('45.00');

      expect(response.body.calculations.tax_amount.success).toBe(false);
      expect(response.body.calculations.tax_amount.error).toContain('Missing required field values');
    });

    it('should return calculation order and dependencies', async () => {
      const responses = {
        quantity: '2',
        price: '25.00',
        tax_rate: '5'
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses })
        .expect(200);

      expect(response.body).toHaveProperty('calculationOrder');
      expect(response.body.calculationOrder).toEqual(['subtotal', 'tax_amount', 'total']);

      expect(response.body).toHaveProperty('dependencyGraph');
      expect(response.body.dependencyGraph).toHaveProperty('subtotal');
      expect(response.body.dependencyGraph.subtotal).toEqual(['quantity', 'price']);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Missing responses
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Responses are required');
    });

    it('should return error for non-existent form', async () => {
      const nonExistentFormId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/forms/${nonExistentFormId}/calculations/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses: {} })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Form not found');
    });
  });

  describe('POST /api/forms/:formId/fields/:fieldId/calculation', () => {
    it('should calculate a specific field', async () => {
      const responses = {
        quantity: '4',
        price: '12.75'
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/fields/subtotal/calculation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.calculation.success).toBe(true);
      expect(response.body.calculation.value).toBe('51.00');
      expect(response.body.calculation.displayValue).toBe('$51.00');
      expect(response.body.calculation.dependencies).toEqual(['quantity', 'price']);
    });

    it('should return error for missing dependencies', async () => {
      const responses = {
        quantity: '4'
        // Missing price
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/fields/subtotal/calculation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Missing required field values');
      expect(response.body.missingFields).toEqual(['price']);
    });

    it('should return error for non-calculation field', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/fields/quantity/calculation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses: {} })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Field is not a calculation field');
    });

    it('should return error for non-existent field', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/fields/non-existent/calculation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses: {} })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Calculation field not found');
    });
  });

  describe('PUT /api/forms/:formId/fields/:fieldId/calculation', () => {
    it('should update calculation configuration for a field', async () => {
      const calculationConfig = {
        enabled: true,
        formula: '{{quantity}} * {{price}} * 1.1', // Add 10% markup
        dependencies: ['quantity', 'price'],
        displayType: 'currency'
      };

      const response = await request(app)
        .put(`/api/forms/${testForm._id}/fields/subtotal/calculation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ calculation: calculationConfig })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.field.calculation.formula).toBe('{{quantity}} * {{price}} * 1.1');

      // Verify in database
      const updatedForm = await Form.findById(testForm._id);
      const subtotalField = updatedForm!.fields.find(f => f.id === 'subtotal');
      expect(subtotalField!.calculation.formula).toBe('{{quantity}} * {{price}} * 1.1');
    });

    it('should validate formula syntax', async () => {
      const invalidConfig = {
        enabled: true,
        formula: '{{quantity}} * * {{price}}', // Invalid syntax
        dependencies: ['quantity', 'price'],
        displayType: 'currency'
      };

      const response = await request(app)
        .put(`/api/forms/${testForm._id}/fields/subtotal/calculation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ calculation: invalidConfig })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid formula syntax');
    });

    it('should validate dependencies exist in form', async () => {
      const invalidConfig = {
        enabled: true,
        formula: '{{quantity}} * {{invalid_field}}',
        dependencies: ['quantity', 'invalid_field'],
        displayType: 'currency'
      };

      const response = await request(app)
        .put(`/api/forms/${testForm._id}/fields/subtotal/calculation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ calculation: invalidConfig })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Referenced field "invalid_field" does not exist');
    });

    it('should detect circular dependencies', async () => {
      // Try to make subtotal depend on total (which depends on subtotal)
      const circularConfig = {
        enabled: true,
        formula: '{{total}} / 2',
        dependencies: ['total'],
        displayType: 'currency'
      };

      const response = await request(app)
        .put(`/api/forms/${testForm._id}/fields/subtotal/calculation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ calculation: circularConfig })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Circular dependency detected');
    });

    it('should disable calculation for a field', async () => {
      const disableConfig = {
        enabled: false,
        formula: '',
        dependencies: [],
        displayType: 'number'
      };

      const response = await request(app)
        .put(`/api/forms/${testForm._id}/fields/subtotal/calculation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ calculation: disableConfig })
        .expect(200);

      expect(response.body.field.calculation.enabled).toBe(false);

      // Verify in database
      const updatedForm = await Form.findById(testForm._id);
      const subtotalField = updatedForm!.fields.find(f => f.id === 'subtotal');
      expect(subtotalField!.calculation.enabled).toBe(false);
    });
  });

  describe('GET /api/forms/:formId/calculations/summary', () => {
    it('should get calculation summary for form', async () => {
      const response = await request(app)
        .get(`/api/forms/${testForm._id}/calculations/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalFields).toBe(6);
      expect(response.body.summary.calculationFields).toBe(3);
      expect(response.body.summary.inputFields).toBe(3);
      expect(response.body.summary.calculationOrder).toEqual(['subtotal', 'tax_amount', 'total']);

      expect(response.body.summary.fieldDetails).toHaveLength(6);
      const subtotalDetail = response.body.summary.fieldDetails.find(
        (f: any) => f.fieldId === 'subtotal'
      );
      expect(subtotalDetail.isCalculation).toBe(true);
      expect(subtotalDetail.dependencies).toEqual(['quantity', 'price']);
    });

    it('should include dependency graph when requested', async () => {
      const response = await request(app)
        .get(`/api/forms/${testForm._id}/calculations/summary?includeDependencyGraph=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.summary).toHaveProperty('dependencyGraph');
      expect(response.body.summary.dependencyGraph).toHaveProperty('subtotal');
      expect(response.body.summary.dependencyGraph.subtotal).toEqual(['quantity', 'price']);
      expect(response.body.summary.dependencyGraph.tax_amount).toEqual(['subtotal', 'tax_rate']);
    });

    it('should handle form without calculations', async () => {
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
        .get(`/api/forms/${simpleForm._id}/calculations/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.summary.totalFields).toBe(1);
      expect(response.body.summary.calculationFields).toBe(0);
      expect(response.body.summary.calculationOrder).toEqual([]);
    });
  });

  describe('POST /api/forms/:formId/calculations/test', () => {
    it('should test calculations with sample data', async () => {
      const testData = {
        scenarios: [
          {
            name: 'Small Order',
            responses: { quantity: '2', price: '5.00', tax_rate: '8' }
          },
          {
            name: 'Large Order',
            responses: { quantity: '10', price: '50.00', tax_rate: '10' }
          }
        ]
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.testResults).toHaveLength(2);

      const smallOrderResult = response.body.testResults.find(
        (r: any) => r.scenarioName === 'Small Order'
      );
      expect(smallOrderResult.calculations.subtotal.value).toBe('10.00');
      expect(parseFloat(smallOrderResult.calculations.total.value)).toBeCloseTo(10.80, 2);

      const largeOrderResult = response.body.testResults.find(
        (r: any) => r.scenarioName === 'Large Order'
      );
      expect(largeOrderResult.calculations.subtotal.value).toBe('500.00');
      expect(parseFloat(largeOrderResult.calculations.total.value)).toBeCloseTo(550.00, 2);
    });

    it('should generate default test scenarios if none provided', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.testResults).toBeDefined();
      expect(response.body.testResults.length).toBeGreaterThan(0);
    });

    it('should handle test scenarios with missing data', async () => {
      const testData = {
        scenarios: [
          {
            name: 'Incomplete Data',
            responses: { quantity: '5' } // Missing price and tax_rate
          }
        ]
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData)
        .expect(200);

      const result = response.body.testResults[0];
      expect(result.calculations.subtotal.success).toBe(false);
      expect(result.calculations.subtotal.missingFields).toContain('price');
    });

    it('should validate test scenario data', async () => {
      const invalidTestData = {
        scenarios: [
          {
            // Missing name
            responses: { quantity: '5', price: '10' }
          }
        ]
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTestData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Scenario name is required');
    });
  });

  describe('POST /api/forms/:formId/calculations/validate-formula', () => {
    it('should validate formula syntax and dependencies', async () => {
      const formulaData = {
        formula: '{{quantity}} * {{price}} + 5',
        dependencies: ['quantity', 'price']
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/validate-formula`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(formulaData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.validation.isValid).toBe(true);
      expect(response.body.validation.errors).toHaveLength(0);
      expect(response.body.validation.dependencies).toEqual(['quantity', 'price']);
    });

    it('should detect invalid formula syntax', async () => {
      const formulaData = {
        formula: '{{quantity}} * * {{price}}',
        dependencies: ['quantity', 'price']
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/validate-formula`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(formulaData)
        .expect(200);

      expect(response.body.validation.isValid).toBe(false);
      expect(response.body.validation.errors).toContain('Invalid formula syntax');
    });

    it('should detect invalid field references', async () => {
      const formulaData = {
        formula: '{{quantity}} * {{invalid_field}}',
        dependencies: ['quantity', 'invalid_field']
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/validate-formula`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(formulaData)
        .expect(200);

      expect(response.body.validation.isValid).toBe(false);
      expect(response.body.validation.errors).toContain('Referenced field "invalid_field" does not exist');
    });

    it('should test formula with sample values', async () => {
      const formulaData = {
        formula: '{{quantity}} * {{price}} * 1.1',
        dependencies: ['quantity', 'price'],
        testValues: { quantity: 5, price: 10 }
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/validate-formula`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(formulaData)
        .expect(200);

      expect(response.body.validation.isValid).toBe(true);
      expect(response.body.validation.testResult).toBeDefined();
      expect(response.body.validation.testResult.value).toBe(55);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle authentication errors', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/calculate`)
        .send({ responses: {} })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No token');
    });

    it('should handle invalid ObjectId format', async () => {
      const response = await request(app)
        .post('/api/forms/invalid-id/calculations/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses: {} })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle division by zero in calculations', async () => {
      // Add a field that could cause division by zero
      testForm.fields.push({
        id: 'division_test',
        type: 'calculated',
        label: 'Division Test',
        required: false,
        order: 6,
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

      const responses = {
        quantity: '10',
        price: '0' // Will cause division by zero
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses })
        .expect(200);

      expect(response.body.calculations.division_test.success).toBe(false);
      expect(response.body.calculations.division_test.error).toContain('Division by zero');
    });

    it('should handle very large numbers in calculations', async () => {
      const responses = {
        quantity: '999999',
        price: '999999',
        tax_rate: '50'
      };

      const response = await request(app)
        .post(`/api/forms/${testForm._id}/calculations/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responses })
        .expect(200);

      expect(response.body.calculations.subtotal.success).toBe(true);
      expect(typeof parseFloat(response.body.calculations.subtotal.value)).toBe('number');
    });

    it('should handle concurrent calculation requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post(`/api/forms/${testForm._id}/calculations/calculate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ responses: { quantity: '3', price: '15.00', tax_rate: '10' } })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.calculations.subtotal.value).toBe('45.00');
      });
    });
  });
});