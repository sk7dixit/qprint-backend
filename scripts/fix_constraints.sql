BEGIN;

-- 1. Drop existing constraints if they exist (to allow sanitization)
ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_payment_status_check;
ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS check_print_job_status;
ALTER TABLE print_job_drafts DROP CONSTRAINT IF EXISTS check_print_job_draft_status;

-- 2. Sanitize existing data to compliant values
-- print_jobs status
UPDATE print_jobs SET status = 'PENDING_PAYMENT' WHERE status IN ('created', 'pending');
UPDATE print_jobs SET status = 'QUEUED' WHERE status = 'queued';
UPDATE print_jobs SET status = 'PAID' WHERE status = 'paid';

-- print_jobs payment_status
UPDATE print_jobs SET payment_status = 'PENDING_PAYMENT' WHERE payment_status IN ('pending', 'pending_payment');
UPDATE print_jobs SET payment_status = 'PAID' WHERE payment_status IN ('paid', 'Paid');

-- print_job_drafts status
UPDATE print_job_drafts SET status = 'printed' WHERE status = 'ordered';

-- 3. Apply NEW strict constraints
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

ALTER TABLE print_jobs 
ADD CONSTRAINT check_print_job_payment_status 
CHECK (payment_status IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED'));

ALTER TABLE print_job_drafts 
ADD CONSTRAINT check_print_job_draft_status 
CHECK (status IN ('uploaded', 'converting', 'ready_for_preview', 'ready_for_print', 'conversion_failed', 'printed'));

COMMIT;
