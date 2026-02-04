-- Add channel field to campaigns table
ALTER TABLE campaigns ADD COLUMN channel TEXT DEFAULT 'email';
