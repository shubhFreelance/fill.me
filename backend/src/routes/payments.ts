import express, { Response } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/auth';
import { withValidation } from '../middleware/validation';
import { body } from 'express-validator';
import User from '../models/User';
import Form from '../models/Form';
import Stripe from 'stripe';

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Subscription plan validation
const validateSubscription = [
  body('priceId')
    .notEmpty()
    .withMessage('Price ID is required'),
  
  body('paymentMethodId')
    .optional()
    .isString()
    .withMessage('Payment method ID must be a string'),
];

// Payment intent validation
const validatePaymentIntent = [
  body('amount')
    .isInt({ min: 50 })
    .withMessage('Amount must be at least 50 cents'),
  
  body('currency')
    .optional()
    .isIn(['usd', 'eur', 'gbp'])
    .withMessage('Invalid currency'),
  
  body('formId')
    .notEmpty()
    .withMessage('Form ID is required')
    .isMongoId()
    .withMessage('Invalid form ID format'),
];

/**
 * @route   POST /api/payments/create-customer
 * @desc    Create Stripe customer for user
 * @access  Private
 */
router.post('/create-customer', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Check if customer already exists
    if ((user as any).stripeCustomerId) {
      res.status(400).json({
        success: false,
        message: 'Customer already exists'
      });
      return;
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      metadata: {
        userId: user._id.toString()
      }
    });

    // Update user with customer ID
    (user as any).stripeCustomerId = customer.id;
    await user.save();

    res.status(201).json({
      success: true,
      data: {
        customerId: customer.id
      }
    });
  } catch (error: any) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating customer'
    });
  }
});

/**
 * @route   POST /api/payments/create-subscription
 * @desc    Create subscription for user
 * @access  Private
 */
router.post('/create-subscription', protect, withValidation(validateSubscription), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { priceId, paymentMethodId } = req.body;
    const user = req.user!;

    // Ensure customer exists
    let customerId = (user as any).stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        metadata: {
          userId: user._id.toString()
        }
      });
      customerId = customer.id;
      (user as any).stripeCustomerId = customerId;
      await user.save();
    }

    // Attach payment method if provided
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    // Update user subscription status
    const planName = getPlanNameFromPriceId(priceId);
    // Map plan name to match our type system
    const planMapping = {
      'pro': 'professional' as const,
      'enterprise': 'enterprise' as const,
      'free': 'free' as const
    };
    const mappedPlan = planMapping[planName as keyof typeof planMapping] || 'free';
    
    // Map Stripe status to our type system
    const statusMapping = {
      'active': 'active' as const,
      'past_due': 'past_due' as const,
      'canceled': 'canceled' as const,
      'trialing': 'trialing' as const,
      'paused': 'past_due' as const // Map paused to past_due
    };
    const mappedStatus = statusMapping[subscription.status as keyof typeof statusMapping] || 'active';

    user.subscription = {
      plan: mappedPlan,
      status: mappedStatus,
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      features: getDefaultFeatures(mappedPlan)
    };
    await user.save();

    res.status(201).json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        status: subscription.status
      }
    });
  } catch (error: any) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating subscription'
    });
  }
});

/**
 * @route   GET /api/payments/subscription
 * @desc    Get user's subscription details
 * @access  Private
 */
router.get('/subscription', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    if (!user.subscription?.stripeSubscriptionId) {
      res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
      return;
    }

    // Get subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(user.subscription.stripeSubscriptionId);

    // Get upcoming invoice
    let upcomingInvoice = null;
    try {
      upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: (user as any).stripeCustomerId!,
      });
    } catch (error) {
      // No upcoming invoice
    }

    res.status(200).json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          plan: user.subscription.plan,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
        },
        upcomingInvoice: upcomingInvoice ? {
          amount: upcomingInvoice.amount_due,
          currency: upcomingInvoice.currency,
          periodStart: new Date(upcomingInvoice.period_start * 1000),
          periodEnd: new Date(upcomingInvoice.period_end * 1000)
        } : null
      }
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription'
    });
  }
});

/**
 * @route   POST /api/payments/cancel-subscription
 * @desc    Cancel user's subscription
 * @access  Private
 */
router.post('/cancel-subscription', protect, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { cancelImmediately = false } = req.body;

    if (!user.subscription?.stripeSubscriptionId) {
      res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
      return;
    }

    let subscription;
    if (cancelImmediately) {
      // Cancel immediately
      subscription = await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId);
      
      // Update user subscription status
      user.subscription.status = 'canceled';
      user.subscription.plan = 'free';
    } else {
      // Cancel at period end
      subscription = await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
      
      // Update user subscription
      user.subscription.cancelAtPeriodEnd = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      }
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error canceling subscription'
    });
  }
});

/**
 * @route   POST /api/payments/create-payment-intent
 * @desc    Create payment intent for form payments
 * @access  Public
 */
router.post('/create-payment-intent', withValidation(validatePaymentIntent), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { amount, currency = 'usd', formId, customerEmail } = req.body;

    // Verify form exists and has payment enabled
    const form = await Form.findById(formId);
    if (!form) {
      res.status(404).json({
        success: false,
        message: 'Form not found'
      });
      return;
    }

    // Check if form has payment fields
    const hasPaymentField = form.fields.some(field => field.type === 'payment');
    if (!hasPaymentField) {
      res.status(400).json({
        success: false,
        message: 'Form does not accept payments'
      });
      return;
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Stripe expects amount in cents
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        formId: formId.toString(),
        customerEmail: customerEmail || 'unknown'
      }
    });

    res.status(201).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  } catch (error: any) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment intent'
    });
  }
});

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Stripe webhooks
 * @access  Public
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: express.Request, res: Response): Promise<void> => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the event
    switch (event.type) {
      case 'subscription.created' as any:
      case 'subscription.updated' as any:
        await handleSubscriptionUpdate((event as any).data.object as Stripe.Subscription);
        break;
      
      case 'subscription.deleted' as any:
        await handleSubscriptionDeleted((event as any).data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      case 'payment_intent.succeeded':
        await handleFormPaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing error'
    });
  }
});

/**
 * @route   GET /api/payments/prices
 * @desc    Get available subscription prices
 * @access  Public
 */
router.get('/prices', async (req: express.Request, res: Response): Promise<void> => {
  try {
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product']
    });

    const formattedPrices = prices.data.map(price => ({
      id: price.id,
      productId: price.product,
      unitAmount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval,
      intervalCount: price.recurring?.interval_count,
      product: {
        name: (price.product as Stripe.Product).name,
        description: (price.product as Stripe.Product).description
      }
    }));

    res.status(200).json({
      success: true,
      data: formattedPrices
    });
  } catch (error: any) {
    console.error('Get prices error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prices'
    });
  }
});

// Helper functions

function getPlanNameFromPriceId(priceId: string): 'free' | 'pro' | 'enterprise' {
  // Map price IDs to plan names
  // This would be configured based on your Stripe price IDs
  const planMapping: { [key: string]: 'free' | 'pro' | 'enterprise' } = {
    'price_pro_monthly': 'pro',
    'price_pro_yearly': 'pro',
    'price_enterprise_monthly': 'enterprise',
    'price_enterprise_yearly': 'enterprise',
  };

  return planMapping[priceId] || 'pro';
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  try {
    const user = await User.findOne({ stripeCustomerId: subscription.customer as string });
    if (!user) return;

    // Map Stripe status to our type system
    const statusMapping = {
      'active': 'active' as const,
      'past_due': 'past_due' as const,
      'canceled': 'canceled' as const,
      'trialing': 'trialing' as const,
      'paused': 'past_due' as const
    };
    const mappedStatus = statusMapping[subscription.status as keyof typeof statusMapping] || 'active';

    // Update user subscription
    user.subscription = {
      plan: user.subscription?.plan || 'professional',
      status: mappedStatus,
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      features: getDefaultFeatures(user.subscription?.plan || 'professional')
    };

    await user.save();
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  try {
    const user = await User.findOne({ stripeCustomerId: subscription.customer as string });
    if (!user) return;

    // Downgrade to free plan
    user.subscription = {
      plan: 'free',
      status: 'canceled',
      stripeSubscriptionId: undefined,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
      features: getDefaultFeatures('free')
    };

    await user.save();
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  try {
    const user = await User.findOne({ stripeCustomerId: invoice.customer as string });
    if (!user) return;

    // Update subscription status if needed
    if (user.subscription && user.subscription.status !== 'active') {
      user.subscription.status = 'active';
      await user.save();
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  try {
    const user = await User.findOne({ stripeCustomerId: invoice.customer as string });
    if (!user) return;

    // Update subscription status
    if (user.subscription) {
      user.subscription.status = 'past_due';
      await user.save();
    }

    // TODO: Send notification email about failed payment
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleFormPaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    const formId = paymentIntent.metadata.formId;
    if (!formId) return;

    // Update form analytics or create payment record
    const form = await Form.findById(formId);
    if (form) {
      // You could track payment analytics here
      console.log(`Payment succeeded for form ${formId}: ${paymentIntent.amount_received / 100} ${paymentIntent.currency}`);
    }
  } catch (error) {
    console.error('Error handling form payment succeeded:', error);
  }
}

// Helper function to get default features for a plan
function getDefaultFeatures(plan: 'free' | 'starter' | 'professional' | 'enterprise') {
  const featuresMap = {
    free: {
      maxForms: 3,
      maxResponses: 100,
      maxFileStorage: 100,
      customBranding: false,
      advancedAnalytics: false,
      integrations: false,
      apiAccess: false,
      customDomains: false,
      whiteLabeling: false,
      prioritySupport: false
    },
    starter: {
      maxForms: 10,
      maxResponses: 1000,
      maxFileStorage: 500,
      customBranding: true,
      advancedAnalytics: false,
      integrations: false,
      apiAccess: false,
      customDomains: false,
      whiteLabeling: false,
      prioritySupport: false
    },
    professional: {
      maxForms: 50,
      maxResponses: 10000,
      maxFileStorage: 5000,
      customBranding: true,
      advancedAnalytics: true,
      integrations: true,
      apiAccess: true,
      customDomains: true,
      whiteLabeling: false,
      prioritySupport: true
    },
    enterprise: {
      maxForms: -1,
      maxResponses: -1,
      maxFileStorage: -1,
      customBranding: true,
      advancedAnalytics: true,
      integrations: true,
      apiAccess: true,
      customDomains: true,
      whiteLabeling: true,
      prioritySupport: true
    }
  };
  return featuresMap[plan];
}

export default router;