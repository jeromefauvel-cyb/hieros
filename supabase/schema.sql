-- ============================================
-- HIEROS — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1) ANNOUNCEMENTS (header message)
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) MENU_ITEMS (left panel buttons)
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(21) NOT NULL,
  label VARCHAR(50) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  font_size INT DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3) SUBMENU_ITEMS (right panel codes)
CREATE TABLE IF NOT EXISTS submenu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(21) NOT NULL,
  label VARCHAR(50) NOT NULL,
  ref VARCHAR(21) DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4) CONTENT_SECTIONS (central content per module)
CREATE TABLE IF NOT EXISTS content_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_key VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(100) NOT NULL,
  body TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE submenu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_sections ENABLE ROW LEVEL SECURITY;

-- Public read access (anon can SELECT active rows)
CREATE POLICY "Public read announcements"
  ON announcements FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public read menu_items"
  ON menu_items FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public read submenu_items"
  ON submenu_items FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public read content_sections"
  ON content_sections FOR SELECT
  USING (is_active = true);

-- Service role has full access (bypasses RLS automatically)
-- No additional policies needed for admin operations

-- ============================================
-- SEED DATA
-- ============================================

-- Default announcement
INSERT INTO announcements (message, is_active) VALUES
  ('ANNOUCEMENT / MESSAGE', true);

-- Menu items (left panel)
INSERT INTO menu_items (code, label, sort_order) VALUES
  ('BTV', 'BTV', 1),
  ('G7', 'G7', 2),
  ('CRE', 'CRE', 3),
  ('RLY', 'RLY', 4),
  ('$', '$', 5),
  ('€', '€', 6),
  ('£', '£', 7),
  ('¥', '¥', 8),
  ('SUR', 'SUR', 9),
  ('CCM', 'CCM', 10),
  ('JVH', 'JVH', 11),
  ('PIZ', 'PIZ', 12),
  ('PYP', 'PYP', 13);

-- Submenu items (right panel)
INSERT INTO submenu_items (code, label, ref, sort_order) VALUES
  ('ZE-NE13', 'ZE-NE13', '', 1),
  ('FLAMOTS', 'FLAMOTS', 'LM-M665/A', 2),
  ('TIMEOUT', 'TIMEOUT', 'IS-R31b/C', 3),
  ('DGL_2115', 'DGL_2115', '', 4),
  ('JPK_GVR', 'JPK_GVR', 'LO-c324/C', 5),
  ('REDUNO_WP', 'REDUNO_WP', 'LN-5523', 6),
  ('UNICODE', 'UNICODE', '', 7),
  ('MATRIX', 'MATRIX', 'N-RE90', 8),
  ('WB_READY', 'WB_READY', 'FE-/094', 9),
  ('_MCN', '_MCN', '', 10),
  ('MATT_THQ', 'MATT_THQ', 'CB-S4C5', 11),
  ('HANDLER', 'HANDLER', 'RQ-28C/3', 12);

-- Content sections
INSERT INTO content_sections (module_key, title, body) VALUES
  ('btc', 'BTC / USDT', 'PRIX EN TEMPS RÉEL'),
  ('xau', 'XAU / USD (OR)', 'PRIX EN TEMPS RÉEL'),
  ('xag', 'XAG / USD (ARGENT)', 'PRIX EN TEMPS RÉEL'),
  ('cl1', 'CRUDE OIL (WTI)', 'PRIX EN TEMPS RÉEL'),
  ('calc', 'CALCULATRICE TAUX COMPOSÉS', 'MODULE EN CONSTRUCTION...'),
  ('moon', 'CYCLES LUNAIRES', 'MODULE EN CONSTRUCTION...'),
  ('penalty', 'PENALTY 1V1', 'MODULE EN CONSTRUCTION...'),
  ('client', 'ESPACE CLIENT', 'AUTHENTIFICATION REQUISE...'),
  ('telegram', 'MESSAGERIE TELEGRAM', 'CONNEXION AU BOT...');

-- ============================================
-- REALTIME (enable for live updates)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE submenu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE content_sections;
