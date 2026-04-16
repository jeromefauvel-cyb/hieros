-- Migration: add title_color and body_color to content_sections
ALTER TABLE content_sections ADD COLUMN IF NOT EXISTS title_color VARCHAR(20) DEFAULT '#FF8C00';
ALTER TABLE content_sections ADD COLUMN IF NOT EXISTS body_color VARCHAR(20) DEFAULT '#FFFFFF';
