-- Add Stripe subscription fields to businesses table
-- Created: 2026-02-04

ALTER TABLE businesses
ADD COLUMN plan_type TEXT DEFAULT 'free',
ADD COLUMN subscription_status TEXT,
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN customer_limit INTEGER DEFAULT 50,
ADD COLUMN campaign_limit INTEGER DEFAULT 3;

-- Create indexes for faster lookups
CREATE INDEX idx_businesses_stripe_customer_id ON businesses(stripe_customer_id);
CREATE INDEX idx_businesses_stripe_subscription_id ON businesses(stripe_subscription_id);
CREATE INDEX idx_businesses_plan_type ON businesses(plan_type);

-- Add check constraint for plan_type
ALTER TABLE businesses
ADD CONSTRAINT check_plan_type CHECK (plan_type IN ('free', 'pro', 'business'));

-- Add check constraint for subscription_status
ALTER TABLE businesses
ADD CONSTRAINT check_subscription_status CHECK (
    subscription_status IS NULL OR 
    subscription_status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'trialing')
);

-- Add comment for documentation
COMMENT ON COLUMN businesses.plan_type IS 'Subscription plan: free (50 customers, 3 campaigns), pro (500 customers, 20 campaigns), business (2000 customers, 100 campaigns)';
COMMENT ON COLUMN businesses.customer_limit IS 'Maximum number of customers allowed for current plan';
COMMENT ON COLUMN businesses.campaign_limit IS 'Maximum number of campaigns allowed for current plan';
