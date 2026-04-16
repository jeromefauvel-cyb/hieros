-- Migration: add is_scrolling and text_align to announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_scrolling BOOLEAN DEFAULT false;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS text_align VARCHAR(10) DEFAULT 'center';
