import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Try both possible environment variable names for Stripe
const stripeSecret = Deno.env.get('STRIPE_API_KEY');
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

if (!stripeSecret) {
  throw new Error('Missing Stripe API key. Please set STRIPE_API_KEY environment variable.');
}

if (!stripeWebhookSecret) {
  throw new Error('Missing Stripe webhook secret. Please set STRIPE_WEBHOOK_SECRET environment variable.');
}

const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'PricePilot Stripe Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    // get the raw body
    const body = await req.text();

    let event: Stripe.Event;

    // Only verify webhook signature if secret is provided
    if (stripeWebhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
      } catch (error: any) {
        console.error(`Webhook signature verification failed: ${error.message}`);
        return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
      }
    } else {
      // In development, parse the body directly without signature verification
      try {
        event = JSON.parse(body);
      } catch (error: any) {
        console.error(`Failed to parse webhook body: ${error.message}`);
        return new Response(`Failed to parse webhook body: ${error.message}`, { status: 400 });
      }
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  console.info(`Processing Stripe webhook event: ${event.type}`);
  
  // Handle subscription lifecycle events directly
  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    
    switch (event.type) {
      case 'customer.subscription.created':
        console.info(`Subscription created for customer: ${customerId}`);
        await handleSubscriptionCreated(subscription);
        break;
        
      case 'customer.subscription.updated':
        console.info(`Subscription updated for customer: ${customerId}`);
        await handleSubscriptionUpdated(subscription);
        break;
        
      case 'customer.subscription.deleted':
        console.info(`Subscription deleted for customer: ${customerId}`);
        await handleSubscriptionDeleted(subscription);
        break;
        
      default:
        console.info(`Unhandled subscription event: ${event.type}`);
    }
    return;
  }
  
  // Handle other events
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  if (!('customer' in stripeData)) {
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event
  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        // Extract the necessary information from the session
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
        } = stripeData as Stripe.Checkout.Session;

        // Insert the order into the stripe_orders table
        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed', // assuming we want to mark it as completed since payment is successful
        });

        if (orderError) {
          console.error('Error inserting order:', orderError);
          return;
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
    }
  }
}

// Handle subscription created event
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  try {
    const { error } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (error) {
      console.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription in database');
    }
    
    console.info(`Successfully created subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to handle subscription created for customer ${customerId}:`, error);
    throw error;
  }
}

// Handle subscription updated event
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  try {
    const { error } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (error) {
      console.error('Error updating subscription:', error);
      throw new Error('Failed to update subscription in database');
    }
    
    console.info(`Successfully updated subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to handle subscription updated for customer ${customerId}:`, error);
    throw error;
  }
}

// Handle subscription deleted event
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  try {
    const { error } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        status: 'canceled',
        cancel_at_period_end: true,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (error) {
      console.error('Error deleting subscription:', error);
      throw new Error('Failed to delete subscription in database');
    }
    
    console.info(`Successfully marked subscription as deleted for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to handle subscription deleted for customer ${customerId}:`, error);
    throw error;
  }
}

// based on the excellent https://github.com/t3dotgg/stripe-recommendations
async function syncCustomerFromStripe(customerId: string) {
  try {
    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    // TODO verify if needed
    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
    }

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data[0];

    // store subscription state
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}