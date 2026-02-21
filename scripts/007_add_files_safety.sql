-- Migration: Add Files Safety Columns
-- Description: Adds expires_at for storage cleanup and file_deleted for tracking.

ALTER TABLE files 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS file_deleted BOOLEAN DEFAULT FALSE;

-- Update existing records if any
UPDATE files SET expires_at = created_at + INTERVAL '1 hour' WHERE expires_at IS NULL;
