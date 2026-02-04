-- Add SMS support fields
-- Created: 2026-02-04 08:30 UTC

-- Add opt_out field to customers table
ALTER TABLE customers ADD COLUMN opt_out BOOLEAN NOT NULL DEFAULT false;

-- Add delivery_status field to messages table
ALTER TABLE messages ADD COLUMN delivery_status TEXT;

-- Add index on opt_out for filtering
CREATE INDEX idx_customers_opt_out ON customers(opt_out);

-- Add index on delivery_status for tracking
CREATE INDEX idx_messages_delivery_status ON messages(delivery_status);

-- Add twilio_message_sid for tracking Twilio messages
ALTER TABLE messages ADD COLUMN twilio_message_sid TEXT;
