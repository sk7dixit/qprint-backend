-- Migration: Enforce Status Enums
-- Description: Adds CHECK constraints to ensure data integrity for job and payment states.

-- print_jobs statuses
ALTER TABLE print_jobs 
DROP CONSTRAINT IF EXISTS check_print_job_status;

ALTER TABLE print_jobs 
ADD CONSTRAINT check_print_job_status 
CHECK (status IN (
  'UPLOADED',
  'PENDING_PAYMENT',
  'PAID',
  'QUEUED',
  'PRINTING',
  'PRINTED',
  'FAILED',
  'CANCELLED'
));

-- print_jobs payment_status (Standardizing to uppercase if needed or keeping current but ensuring values)
ALTER TABLE print_jobs 
DROP CONSTRAINT IF EXISTS print_jobs_payment_status_check;

ALTER TABLE print_jobs 
ADD CONSTRAINT check_print_job_payment_status 
CHECK (payment_status IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED'));

-- print_job_drafts statuses
ALTER TABLE print_job_drafts 
DROP CONSTRAINT IF EXISTS check_print_job_draft_status;

ALTER TABLE print_job_drafts 
ADD CONSTRAINT check_print_job_draft_status 
CHECK (status IN ('uploaded', 'converting', 'ready_for_preview', 'ready_for_print', 'conversion_failed', 'printed'));
