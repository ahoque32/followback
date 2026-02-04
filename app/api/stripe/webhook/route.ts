import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe client
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-01-28.clover',
  });
}

// Initialize Supabase with service role key (bypasses RLS)
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// Plan limits configuration
const PLAN_LIMITS = {
  free: {
    customer_limit: 50,
    campaign_limit: 3,
  },
  pro: {
    customer_limit: 500,
    campaign_limit: 20,
  },
  business: {
    customer_limit: 2000,
    campaign_limit: 100,
  },
};

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const supabase = getSupabaseClient();
  
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, supabase);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription, supabase);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, supabase);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, supabase: ReturnType<typeof getSupabaseClient>) {
  const businessId = session.metadata?.business_id;
  const planType = session.metadata?.plan_type as 'pro' | 'business';

  if (!businessId || !planType) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  // Get subscription details
  let subscriptionId: string | null = null;
  if (typeof session.subscription === 'string') {
    subscriptionId = session.subscription;
  }

  const limits = PLAN_LIMITS[planType];

  // Update business with subscription details
  const { error } = await supabase
    .from('businesses')
    .update({
      plan_type: planType,
      subscription_status: 'active',
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscriptionId,
      customer_limit: limits.customer_limit,
      campaign_limit: limits.campaign_limit,
    })
    .eq('id', businessId);

  if (error) {
    console.error('Error updating business after checkout:', error);
    throw error;
  }

  console.log(`Checkout completed for business ${businessId}, plan: ${planType}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription, supabase: ReturnType<typeof getSupabaseClient>) {
  const customerId = subscription.customer as string;

  // Find business by Stripe customer ID
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (businessError || !business) {
    console.error('Business not found for customer:', customerId);
    return;
  }

  // Determine plan type from subscription items
  let planType: 'pro' | 'business' = 'pro';
  const priceId = subscription.items.data[0]?.price.id;
  
  if (priceId === process.env.STRIPE_PRICE_ID_BUSINESS) {
    planType = 'business';
  } else if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
    planType = 'pro';
  }

  const limits = PLAN_LIMITS[planType];

  // Update business with subscription details
  const { error } = await supabase
    .from('businesses')
    .update({
      plan_type: planType,
      subscription_status: subscription.status,
      stripe_subscription_id: subscription.id,
      customer_limit: limits.customer_limit,
      campaign_limit: limits.campaign_limit,
    })
    .eq('id', business.id);

  if (error) {
    console.error('Error updating business subscription:', error);
    throw error;
  }

  console.log(`Subscription updated for business ${business.id}, status: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: ReturnType<typeof getSupabaseClient>) {
  const customerId = subscription.customer as string;

  // Find business by Stripe customer ID
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (businessError || !business) {
    console.error('Business not found for customer:', customerId);
    return;
  }

  // Revert to free plan
  const limits = PLAN_LIMITS.free;

  const { error } = await supabase
    .from('businesses')
    .update({
      plan_type: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      customer_limit: limits.customer_limit,
      campaign_limit: limits.campaign_limit,
    })
    .eq('id', business.id);

  if (error) {
    console.error('Error reverting business to free plan:', error);
    throw error;
  }

  console.log(`Subscription deleted for business ${business.id}, reverted to free plan`);
}
