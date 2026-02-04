import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase-server';

interface CheckoutRequest {
  plan: 'pro' | 'business';
}

// Initialize Stripe client
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-01-28.clover',
  });
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();

    // Authenticate user
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CheckoutRequest = await request.json();
    
    // Validate plan
    if (!body.plan || !['pro', 'business'].includes(body.plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "pro" or "business"' },
        { status: 400 }
      );
    }

    // Get user's business from Supabase
    const supabase = await createSupabaseServerClient();
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, stripe_customer_id')
      .eq('owner_id', userId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Get the appropriate Stripe price ID
    const priceId = body.plan === 'pro' 
      ? process.env.STRIPE_PRICE_ID_PRO 
      : process.env.STRIPE_PRICE_ID_BUSINESS;

    if (!priceId) {
      console.error('Missing Stripe price ID for plan:', body.plan);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create or retrieve Stripe customer
    let customerId = business.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          clerk_user_id: userId,
          business_id: business.id,
        },
      });
      customerId = customer.id;

      // Update business with Stripe customer ID
      await supabase
        .from('businesses')
        .update({ stripe_customer_id: customerId })
        .eq('id', business.id);
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?canceled=true`,
      metadata: {
        clerk_user_id: userId,
        business_id: business.id,
        plan_type: body.plan,
      },
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
