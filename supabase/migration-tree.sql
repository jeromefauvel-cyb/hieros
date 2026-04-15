-- ============================================
-- HIEROS — Tree hierarchy migration
-- Adds parent_id and position to menu_items and submenu_items
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1) MENU_ITEMS: add parent_id (self-referencing) and position
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position INT DEFAULT 0;

-- Backfill position from sort_order
UPDATE menu_items SET position = sort_order WHERE position = 0 OR position IS NULL;

-- 2) SUBMENU_ITEMS: add parent_id (self-referencing) and position
ALTER TABLE submenu_items
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES submenu_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position INT DEFAULT 0;

-- Backfill position from sort_order
UPDATE submenu_items SET position = sort_order WHERE position = 0 OR position IS NULL;
