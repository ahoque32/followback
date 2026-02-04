-- FollowBack CRM Initial Schema Migration
-- Created: 2026-02-04

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Businesses table
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on owner_id for faster lookups
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);

-- Customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    last_visit DATE,
    visit_count INTEGER NOT NULL DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for customers
CREATE INDEX idx_customers_business_id ON customers(business_id);
CREATE INDEX idx_customers_email ON customers(email);

-- Campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template TEXT,
    trigger_days INTEGER,
    discount_percent INTEGER,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on business_id for campaigns
CREATE INDEX idx_campaigns_business_id ON campaigns(business_id);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel TEXT,
    status TEXT,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ
);

-- Create indexes for messages
CREATE INDEX idx_messages_campaign_id ON messages(campaign_id);
CREATE INDEX idx_messages_customer_id ON messages(customer_id);
CREATE INDEX idx_messages_status ON messages(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Businesses policies
-- Users can only see/manage their own businesses
CREATE POLICY "Users can view their own businesses"
    ON businesses
    FOR SELECT
    USING (owner_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert their own businesses"
    ON businesses
    FOR INSERT
    WITH CHECK (owner_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update their own businesses"
    ON businesses
    FOR UPDATE
    USING (owner_id = auth.jwt() ->> 'sub')
    WITH CHECK (owner_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete their own businesses"
    ON businesses
    FOR DELETE
    USING (owner_id = auth.jwt() ->> 'sub');

-- Customers policies
-- Users can only access customers from their own businesses
CREATE POLICY "Users can view customers from their businesses"
    ON customers
    FOR SELECT
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can insert customers to their businesses"
    ON customers
    FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can update customers from their businesses"
    ON customers
    FOR UPDATE
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.jwt() ->> 'sub'
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can delete customers from their businesses"
    ON customers
    FOR DELETE
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.jwt() ->> 'sub'
        )
    );

-- Campaigns policies
-- Users can only access campaigns from their own businesses
CREATE POLICY "Users can view campaigns from their businesses"
    ON campaigns
    FOR SELECT
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can insert campaigns to their businesses"
    ON campaigns
    FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can update campaigns from their businesses"
    ON campaigns
    FOR UPDATE
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.jwt() ->> 'sub'
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can delete campaigns from their businesses"
    ON campaigns
    FOR DELETE
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.jwt() ->> 'sub'
        )
    );

-- Messages policies
-- Users can only access messages from campaigns in their businesses
CREATE POLICY "Users can view messages from their campaigns"
    ON messages
    FOR SELECT
    USING (
        campaign_id IN (
            SELECT c.id FROM campaigns c
            INNER JOIN businesses b ON c.business_id = b.id
            WHERE b.owner_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can insert messages to their campaigns"
    ON messages
    FOR INSERT
    WITH CHECK (
        campaign_id IN (
            SELECT c.id FROM campaigns c
            INNER JOIN businesses b ON c.business_id = b.id
            WHERE b.owner_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can update messages from their campaigns"
    ON messages
    FOR UPDATE
    USING (
        campaign_id IN (
            SELECT c.id FROM campaigns c
            INNER JOIN businesses b ON c.business_id = b.id
            WHERE b.owner_id = auth.jwt() ->> 'sub'
        )
    )
    WITH CHECK (
        campaign_id IN (
            SELECT c.id FROM campaigns c
            INNER JOIN businesses b ON c.business_id = b.id
            WHERE b.owner_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can delete messages from their campaigns"
    ON messages
    FOR DELETE
    USING (
        campaign_id IN (
            SELECT c.id FROM campaigns c
            INNER JOIN businesses b ON c.business_id = b.id
            WHERE b.owner_id = auth.jwt() ->> 'sub'
        )
    );
