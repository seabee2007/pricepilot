import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Stripe
    const stripeSecret = Deno.env.get('STRIPE_API_KEY');
    if (!stripeSecret) {
      throw new Error('Missing Stripe API key');
    }

    const stripe = new Stripe(stripeSecret, {
      appInfo: {
        name: 'PricePilot Subscription Management',
        version: '1.0.0',
      },
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, subscription_id, price_id } = await req.json();

    if (!action || !subscription_id) {
      throw new Error('Action and subscription_id are required');
    }

    let result;

    switch (action) {
      case 'cancel':
        // Cancel subscription at period end
        result = await stripe.subscriptions.update(subscription_id, {
          cancel_at_period_end: true,
        });
        break;

      case 'reactivate':
        // Reactivate a subscription that was set to cancel
        result = await stripe.subscriptions.update(subscription_id, {
          cancel_at_period_end: false,
        });
        break;

      case 'cancel_immediately':
        // Cancel subscription immediately
        result = await stripe.subscriptions.cancel(subscription_id);
        break;

      case 'change_plan':
        // Change subscription plan
        if (!price_id) {
          throw new Error('price_id is required for plan changes');
        }
        
        const subscription = await stripe.subscriptions.retrieve(subscription_id);
        result = await stripe.subscriptions.update(subscription_id, {
          items: [{
            id: subscription.items.data[0].id,
            price: price_id,
          }],
          proration_behavior: 'create_prorations',
        });
        break;

      case 'pause':
        // Pause subscription
        result = await stripe.subscriptions.update(subscription_id, {
          pause_collection: {
            behavior: 'keep_as_draft',
          },
        });
        break;

      case 'resume':
        // Resume paused subscription
        result = await stripe.subscriptions.update(subscription_id, {
          pause_collection: null,
        });
        break;

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    // Update subscription status in database
    const { error: dbError } = await supabase
      .from('stripe_subscriptions')
      .update({
        status: result.status,
        cancel_at_period_end: result.cancel_at_period_end,
        current_period_end: result.current_period_end,
        ...(result.items?.data[0]?.price?.id && { price_id: result.items.data[0].price.id }),
      })
      .eq('subscription_id', subscription_id);

    if (dbError) {
      console.error('Error updating subscription in database:', dbError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        subscription: {
          id: result.id,
          status: result.status,
          cancel_at_period_end: result.cancel_at_period_end,
          current_period_end: result.current_period_end,
        }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('Error managing subscription:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
}); 