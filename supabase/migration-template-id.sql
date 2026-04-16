-- Migration: add template_id to content_sections
ALTER TABLE content_sections ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES page_templates(id) ON DELETE SET NULL;
