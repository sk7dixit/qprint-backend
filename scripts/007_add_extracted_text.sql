-- Migration to add extracted_text to print_job_drafts
ALTER TABLE print_job_drafts ADD COLUMN IF NOT EXISTS extracted_text TEXT;
