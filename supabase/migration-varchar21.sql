-- ============================================
-- HIEROS — Expand varchar columns to 21
-- Run this in the Supabase SQL Editor
-- ============================================

ALTER TABLE menu_items ALTER COLUMN code TYPE VARCHAR(21);
ALTER TABLE submenu_items ALTER COLUMN code TYPE VARCHAR(21);
ALTER TABLE submenu_items ALTER COLUMN ref TYPE VARCHAR(21);
