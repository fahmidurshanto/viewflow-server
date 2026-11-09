const express = require('express');
const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// Plan prices in USD cents
const PLAN_PRICES = {
  Starter: {
    monthly: 2900, // $29.00
    yearly: 27600  // $276.00 ($23/mo)
  },
  Growth: {
    monthly: 7900, // $79.00
    yearly: 75600  // $756.00 ($63/mo)
  },
  Enterprise: {
    monthly: 19900, // $199.00
    yearly: 190800  // $1,908.00 ($159/mo)
  }
};

/**
 * POST /api/payment/create-checkout-session
 * Creates a Stripe Checkout Session for subscription
 */
router.post('/create-checkout-session', protect, async (req, res) => {
  try {
    const { plan, billingCycle } = req.body;

    if (!['Starter', 'Growth', 'Enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan selected' });
    }
    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({ success: false, error: 'Invalid billing cycle' });
    }

    if (!process.env.STRIPE_SECRET_KEY || !stripe) {
      return res.status(500).json({
        success: false,
        error: 'Stripe Secret Key is not configured on the server. Please add STRIPE_SECRET_KEY in viewflow-server/.env'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // 1. Get or create Stripe Customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user._id.toString(),
          agencyName: user.agencyName || ''
        }
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const priceInCents = PLAN_PRICES[plan][billingCycle];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // 2. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `ViewFlow CRM - ${plan} Plan (${billingCycle.toUpperCase()})`,
              description: `Full access to ViewFlow CRM ${plan} features with ${billingCycle} billing.`,
            },
            unit_amount: priceInCents,
            recurring: {
              interval: billingCycle === 'yearly' ? 'year' : 'month'
            }
          },
          quantity: 1
        }
      ],
      mode: 'subscription',
      subscription_data: {
        metadata: {
          userId: user._id.toString(),
          plan,
          billingCycle
        }
      },
      metadata: {
        userId: user._id.toString(),
        plan,
        billingCycle
      },
      success_url: `${frontendUrl}/?tab=pricing&session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${frontendUrl}/?tab=pricing&canceled=true`
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Stripe Checkout Session Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Stripe checkout session'
    });
  }
});

/**
 * POST /api/payment/verify-session
 * Verifies a completed checkout session directly from Stripe API
 * Updates MongoDB user immediately without waiting for webhooks
 */
router.post('/verify-session', protect, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    if (!process.env.STRIPE_SECRET_KEY || !stripe) {
      return res.status(500).json({ success: false, error: 'Stripe is not configured' });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Stripe session not found' });
    }

    if (session.payment_status === 'paid' || session.status === 'complete') {
      const plan = session.metadata?.plan;
      const billingCycle = session.metadata?.billingCycle || 'monthly';

      const user = await User.findById(req.user._id);
      if (user && plan) {
        user.subscriptionPlan = plan;
        user.subscriptionBillingCycle = billingCycle;
        user.subscriptionStatus = 'active';
        if (session.customer) user.stripeCustomerId = session.customer;
        if (session.subscription) user.stripeSubscriptionId = session.subscription;
        await user.save();

        console.log(`🎉 Instant Plan Verification: User ${user.email} updated to ${plan} (${billingCycle})`);

        return res.json({
          success: true,
          plan: user.subscriptionPlan,
          billingCycle: user.subscriptionBillingCycle,
          status: user.subscriptionStatus,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            subscriptionPlan: user.subscriptionPlan,
            subscriptionBillingCycle: user.subscriptionBillingCycle,
            subscriptionStatus: user.subscriptionStatus,
            stripeCustomerId: user.stripeCustomerId,
            stripeSubscriptionId: user.stripeSubscriptionId
          }
        });
      }
    }

    res.json({ success: false, error: 'Payment was not marked as complete' });
  } catch (error) {
    console.error('Verify Stripe Session Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to verify session' });
  }
});

/**
 * POST /api/payment/create-portal-session
 * Customer Billing Management Portal (Cards, Invoices, Cancellation)
 */
router.post('/create-portal-session', protect, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !stripe) {
      return res.status(500).json({
        success: false,
        error: 'Stripe is not configured on the server.'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error: 'No active Stripe customer found. Please subscribe to a plan first.'
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendUrl}/?tab=pricing`
    });

    res.json({
      success: true,
      url: portalSession.url
    });
  } catch (error) {
    console.error('Stripe Portal Session Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create customer portal session'
    });
  }
});

/**
 * POST /api/payment/webhook
 * Handles async events from Stripe (checkout.session.completed, invoice.payment_succeeded, etc.)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret && sig && stripe) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // In development if webhook secret isn't set, parse body safely
      event = typeof req.body === 'string' || Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString())
        : req.body;
    }
  } catch (err) {
    console.error(`⚠️ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle specific event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        const billingCycle = session.metadata?.billingCycle;

        if (userId) {
          await User.findByIdAndUpdate(userId, {
            subscriptionPlan: plan || 'Growth',
            subscriptionBillingCycle: billingCycle || 'monthly',
            subscriptionStatus: 'active',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription
          });
          console.log(`✅ Subscription activated for user ${userId} (${plan} - ${billingCycle})`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        if (customerId) {
          await User.findOneAndUpdate(
            { stripeCustomerId: customerId },
            { subscriptionStatus: 'active' }
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        if (customerId) {
          await User.findOneAndUpdate(
            { stripeCustomerId: customerId },
            {
              subscriptionStatus: 'expired',
              subscriptionPlan: 'Starter'
            }
          );
          console.log(`⚠️ Subscription canceled for customer ${customerId}`);
        }
        break;
      }

      default:
        // Other events ignored
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error handling webhook event:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;

