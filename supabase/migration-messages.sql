-- Migration: create messages table for Telegram chat
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT,
  content TEXT NOT NULL,
  direction VARCHAR(4) NOT NULL DEFAULT 'in', -- 'in' = from user, 'out' = from bot/admin
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
  ON messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_telegram_chat_id ON messages(telegram_chat_id);

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
