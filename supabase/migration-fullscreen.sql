-- Migration: add is_fullscreen and bg_color to content_sections
ALTER TABLE content_sections ADD COLUMN IF NOT EXISTS is_fullscreen BOOLEAN DEFAULT false;
ALTER TABLE content_sections ADD COLUMN IF NOT EXISTS bg_color VARCHAR(20) DEFAULT '#000000';
