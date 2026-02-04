-- Create waitlist table for landing page signups
-- Created: 2026-02-04

CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_waitlist_email ON waitlist(email);

-- Enable RLS on waitlist table
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for landing page)
-- But restrict reads to authenticated admin users only
CREATE POLICY "Anyone can join waitlist"
    ON waitlist
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Only authenticated users can view waitlist"
    ON waitlist
    FOR SELECT
    USING (auth.jwt() ->> 'sub' IS NOT NULL);
