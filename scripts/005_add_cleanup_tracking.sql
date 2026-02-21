-- Migration: Add file_deleted column
-- Description: Tracks whether the physical file has been removed from storage.

ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS file_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE print_job_drafts ADD COLUMN IF NOT EXISTS file_deleted BOOLEAN DEFAULT FALSE;
