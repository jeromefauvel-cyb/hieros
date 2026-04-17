-- Migration: add to_user_id to payment_requests
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
