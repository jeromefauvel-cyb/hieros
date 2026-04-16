-- Migration: create payment_requests and user QR codes
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_card_number VARCHAR(20) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USDT',
  note TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, completed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payment requests"
  ON payment_requests FOR SELECT
  USING (auth.uid() = from_user_id);

CREATE POLICY "Users can insert own payment requests"
  ON payment_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);
