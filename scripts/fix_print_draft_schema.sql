-- Migration to fix print_job_drafts schema
ALTER TABLE print_job_drafts ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 0;
-- source might already exist but let's be sure
ALTER TABLE print_job_drafts ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'editor';
