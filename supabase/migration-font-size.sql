-- Migration: add font_size to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS font_size INT DEFAULT 12;
