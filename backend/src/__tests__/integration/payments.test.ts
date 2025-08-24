import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import { TestUtils } from '../setup';

// Mock Stripe for testing
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({
        id: 'cus_test_123',
        email: 'test@example.com'
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'cus_test_123',
        email: 'test@example.com',
        subscriptions: { data: [] }
      }),
      update: jest.fn().mockResolvedValue({
        id: 'cus_test_123',
        email: 'test@example.com'
      })
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        items: {
          data: [{
            price: {
              id: 'price_professional_monthly',
              nickname: 'Professional Monthly'
            }
          }]
        }
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
      }),
      update: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        status: 'active',
        cancel_at_period_end: true
      }),
      del: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        status: 'canceled'
      })
    },
    paymentMethods: {
      attach: jest.fn().mockResolvedValue({
        id: 'pm_test_123',
        type: 'card'
      }),
      detach: jest.fn().mockResolvedValue({
        id: 'pm_test_123'
      })
    },
    setupIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'seti_test_123',
        client_secret: 'seti_test_123_secret'
      })
    },
    invoices: {
      list: jest.fn().mockResolvedValue({
        data: [{
          id: 'in_test_123',
          amount_paid: 2999,
          currency: 'usd',
          status: 'paid',
          created: Math.floor(Date.now() / 1000),
          invoice_pdf: 'https://example.com/invoice.pdf'
        }]
      })
    },
    prices: {
      list: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'price_starter_monthly',
            nickname: 'Starter Monthly',
            unit_amount: 999,
            currency: 'usd',
            recurring: { interval: 'month' }
          },
          {
            id: 'price_professional_monthly',
            nickname: 'Professional Monthly',
            unit_amount: 2999,
            currency: 'usd',
            recurring: { interval: 'month' }
          }
        ]
      })
    },
    webhookEndpoints: {
      create: jest.fn().mockResolvedValue({
        id: 'we_test_123',
        url: 'https://example.com/webhook'
      })
    }
  }));
});

describe('Payments API Integration Tests', () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});

    // Create test user
    const userData = TestUtils.createTestUser();
    testUser = await User.create(userData);
    authToken = TestUtils.generateToken(testUser._id.toString(), testUser.email);
  });

  afterEach(async () => {
    await User.deleteMany({});
    jest.clearAllMocks();
  });

  describe('GET /api/payments/plans', () => {
    it('should get available subscription plans', async () => {
      const response = await request(app)
        .get('/api/payments/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.plans).toBeInstanceOf(Array);
      expect(response.body.plans.length).toBeGreaterThan(0);
      
      const professionalPlan = response.body.plans.find((p: any) => p.name === 'professional');
      expect(professionalPlan).toBeDefined();
      expect(professionalPlan).toHaveProperty('price');
      expect(professionalPlan).toHaveProperty('features');
    });

    it('should return plans without authentication for public access', async () => {
      const response = await request(app)
        .get('/api/payments/plans')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.plans).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/payments/subscription', () => {
    it('should get current user subscription', async () => {
      const response = await request(app)
        .get('/api/payments/subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.subscription).toHaveProperty('plan', 'free');
      expect(response.body.subscription).toHaveProperty('status', 'active');
      expect(response.body.subscription).toHaveProperty('features');
      expect(response.body.subscription.features).toHaveProperty('maxForms');
      expect(response.body.subscription.features).toHaveProperty('maxResponses');
    });

    it('should return subscription with usage information', async () => {
      const response = await request(app)
        .get('/api/payments/subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.subscription).toHaveProperty('usage');
      expect(response.body.subscription.usage).toHaveProperty('formsCreated');
      expect(response.body.subscription.usage).toHaveProperty('responsesReceived');
      expect(response.body.subscription.usage).toHaveProperty('storageUsed');
    });

    it('should return error without authentication', async () => {
      const response = await request(app)
        .get('/api/payments/subscription')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/payments/create-subscription', () => {
    it('should create a new subscription successfully', async () => {
      const subscriptionData = {
        plan: 'professional',
        paymentMethodId: 'pm_test_123'
      };

      const response = await request(app)
        .post('/api/payments/create-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscriptionData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.subscription).toHaveProperty('id');
      expect(response.body.subscription).toHaveProperty('status', 'active');
      expect(response.body.subscription).toHaveProperty('plan', 'professional');

      // Verify user subscription was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.subscription.plan).toBe('professional');
      expect(updatedUser!.subscription.status).toBe('active');
    });

    it('should return error for invalid plan', async () => {
      const subscriptionData = {
        plan: 'invalid_plan',
        paymentMethodId: 'pm_test_123'
      };

      const response = await request(app)
        .post('/api/payments/create-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscriptionData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid plan');
    });

    it('should return error for missing payment method', async () => {
      const subscriptionData = {
        plan: 'professional'
        // Missing paymentMethodId
      };

      const response = await request(app)
        .post('/api/payments/create-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscriptionData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle existing subscription upgrade', async () => {
      // Set user to starter plan first
      testUser.subscription.plan = 'starter';
      testUser.subscription.stripeSubscriptionId = 'sub_existing_123';
      await testUser.save();

      const subscriptionData = {
        plan: 'professional',
        paymentMethodId: 'pm_test_123'
      };

      const response = await request(app)
        .post('/api/payments/create-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscriptionData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.subscription.plan).toBe('professional');
    });
  });

  describe('POST /api/payments/cancel-subscription', () => {
    beforeEach(async () => {
      // Set up user with active subscription
      testUser.subscription.plan = 'professional';
      testUser.subscription.status = 'active';
      testUser.subscription.stripeSubscriptionId = 'sub_test_123';
      await testUser.save();
    });

    it('should cancel subscription at period end', async () => {
      const response = await request(app)
        .post('/api/payments/cancel-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('will be canceled at the end');

      // Verify user subscription settings
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.subscription.cancelAtPeriodEnd).toBe(true);
    });

    it('should immediately cancel subscription if requested', async () => {
      const response = await request(app)
        .post('/api/payments/cancel-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ immediate: true })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('canceled immediately');
    });

    it('should return error for user without subscription', async () => {
      // Reset user to free plan
      testUser.subscription.plan = 'free';
      testUser.subscription.stripeSubscriptionId = undefined;
      await testUser.save();

      const response = await request(app)
        .post('/api/payments/cancel-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No active subscription');
    });
  });

  describe('POST /api/payments/resume-subscription', () => {
    beforeEach(async () => {
      // Set up user with canceled subscription
      testUser.subscription.plan = 'professional';
      testUser.subscription.status = 'active';
      testUser.subscription.stripeSubscriptionId = 'sub_test_123';
      testUser.subscription.cancelAtPeriodEnd = true;
      await testUser.save();
    });

    it('should resume canceled subscription', async () => {
      const response = await request(app)
        .post('/api/payments/resume-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('resumed successfully');

      // Verify user subscription settings
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.subscription.cancelAtPeriodEnd).toBe(false);
    });

    it('should return error for subscription not set to cancel', async () => {
      // Remove cancellation
      testUser.subscription.cancelAtPeriodEnd = false;
      await testUser.save();

      const response = await request(app)
        .post('/api/payments/resume-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('not scheduled for cancellation');
    });
  });

  describe('POST /api/payments/setup-intent', () => {
    it('should create setup intent for payment method', async () => {
      const response = await request(app)
        .post('/api/payments/setup-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('clientSecret');
      expect(response.body.clientSecret).toContain('seti_test_123_secret');
    });

    it('should create setup intent with customer ID', async () => {
      // Set user with Stripe customer ID
      testUser.subscription.stripeCustomerId = 'cus_test_123';
      await testUser.save();

      const response = await request(app)
        .post('/api/payments/setup-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('clientSecret');
    });
  });

  describe('GET /api/payments/payment-methods', () => {
    beforeEach(async () => {
      // Set user with Stripe customer ID
      testUser.subscription.stripeCustomerId = 'cus_test_123';
      await testUser.save();
    });

    it('should get user payment methods', async () => {
      const response = await request(app)
        .get('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('paymentMethods');
      expect(response.body.paymentMethods).toBeInstanceOf(Array);
    });

    it('should return error for user without Stripe customer', async () => {
      // Remove Stripe customer ID
      testUser.subscription.stripeCustomerId = undefined;
      await testUser.save();

      const response = await request(app)
        .get('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No Stripe customer');
    });
  });

  describe('POST /api/payments/payment-methods', () => {
    beforeEach(async () => {
      testUser.subscription.stripeCustomerId = 'cus_test_123';
      await testUser.save();
    });

    it('should attach payment method to customer', async () => {
      const paymentMethodData = {
        paymentMethodId: 'pm_test_123'
      };

      const response = await request(app)
        .post('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentMethodData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Payment method added');
    });

    it('should return error for missing payment method ID', async () => {
      const response = await request(app)
        .post('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('DELETE /api/payments/payment-methods/:paymentMethodId', () => {
    it('should detach payment method from customer', async () => {
      const paymentMethodId = 'pm_test_123';

      const response = await request(app)
        .delete(`/api/payments/payment-methods/${paymentMethodId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Payment method removed');
    });

    it('should return error for invalid payment method ID', async () => {
      const response = await request(app)
        .delete('/api/payments/payment-methods/invalid_id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/payments/invoices', () => {
    beforeEach(async () => {
      testUser.subscription.stripeCustomerId = 'cus_test_123';
      await testUser.save();
    });

    it('should get user invoices', async () => {
      const response = await request(app)
        .get('/api/payments/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('invoices');
      expect(response.body.invoices).toBeInstanceOf(Array);
      expect(response.body.invoices[0]).toHaveProperty('id', 'in_test_123');
      expect(response.body.invoices[0]).toHaveProperty('amount', 29.99);
      expect(response.body.invoices[0]).toHaveProperty('status', 'paid');
    });

    it('should paginate invoices', async () => {
      const response = await request(app)
        .get('/api/payments/invoices?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.invoices).toBeInstanceOf(Array);
    });

    it('should return error for user without Stripe customer', async () => {
      testUser.subscription.stripeCustomerId = undefined;
      await testUser.save();

      const response = await request(app)
        .get('/api/payments/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/payments/usage', () => {
    it('should get subscription usage statistics', async () => {
      const response = await request(app)
        .get('/api/payments/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.usage).toHaveProperty('formsCreated');
      expect(response.body.usage).toHaveProperty('responsesReceived');
      expect(response.body.usage).toHaveProperty('storageUsed');
      expect(response.body.usage).toHaveProperty('apiCallsThisMonth');
      expect(response.body).toHaveProperty('limits');
      expect(response.body.limits).toHaveProperty('maxForms');
      expect(response.body.limits).toHaveProperty('maxResponses');
    });

    it('should calculate usage percentages', async () => {
      const response = await request(app)
        .get('/api/payments/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('usagePercentages');
      expect(response.body.usagePercentages).toHaveProperty('forms');
      expect(response.body.usagePercentages).toHaveProperty('responses');
      expect(response.body.usagePercentages).toHaveProperty('storage');
    });
  });

  describe('Webhook Handling', () => {
    it('should handle subscription updated webhook', async () => {
      const webhookEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_123',
            customer: 'cus_test_123',
            status: 'active',
            items: {
              data: [{
                price: {
                  id: 'price_professional_monthly',
                  nickname: 'Professional Monthly'
                }
              }]
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
          }
        }
      };

      const response = await request(app)
        .post('/api/payments/webhook')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toHaveProperty('received', true);
    });

    it('should handle payment failed webhook', async () => {
      const webhookEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_test_failed',
            customer: 'cus_test_123',
            subscription: 'sub_test_123'
          }
        }
      };

      const response = await request(app)
        .post('/api/payments/webhook')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toHaveProperty('received', true);
    });
  });

  describe('Plan Limits Enforcement', () => {
    it('should enforce form creation limits', async () => {
      const response = await request(app)
        .get('/api/payments/check-limits/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('canCreate');
      expect(response.body).toHaveProperty('currentUsage');
      expect(response.body).toHaveProperty('limit');
    });

    it('should enforce response limits', async () => {
      const response = await request(app)
        .get('/api/payments/check-limits/responses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('canAccept');
      expect(response.body).toHaveProperty('currentUsage');
      expect(response.body).toHaveProperty('limit');
    });

    it('should enforce storage limits', async () => {
      const response = await request(app)
        .get('/api/payments/check-limits/storage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('canUpload');
      expect(response.body).toHaveProperty('currentUsage');
      expect(response.body).toHaveProperty('limit');
    });
  });

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      // Mock Stripe error
      const stripe = require('stripe')();
      stripe.customers.create.mockRejectedValueOnce(new Error('Stripe API Error'));

      const subscriptionData = {
        plan: 'professional',
        paymentMethodId: 'pm_test_123'
      };

      const response = await request(app)
        .post('/api/payments/create-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscriptionData)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Error creating subscription');
    });

    it('should handle invalid payment method errors', async () => {
      const stripe = require('stripe')();
      stripe.paymentMethods.attach.mockRejectedValueOnce(new Error('Invalid payment method'));

      const response = await request(app)
        .post('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentMethodId: 'pm_invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate subscription data', async () => {
      const invalidData = {
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/payments/create-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});