-- ============================================
-- HIEROS — Site settings (key-value store)
-- Run this in the Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read site_settings"
  ON site_settings FOR SELECT
  USING (true);

-- Seed default menu label
INSERT INTO site_settings (key, value) VALUES
  ('menu_label', 'MENU')
ON CONFLICT (key) DO NOTHING;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE site_settings;
