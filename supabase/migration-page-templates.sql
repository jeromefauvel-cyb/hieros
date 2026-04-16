-- Migration: create page_templates table
CREATE TABLE IF NOT EXISTS page_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  body TEXT DEFAULT '',
  title_color VARCHAR(20) DEFAULT '#FF8C00',
  body_color VARCHAR(20) DEFAULT '#FFFFFF',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE page_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read page_templates"
  ON page_templates FOR SELECT
  USING (true);
