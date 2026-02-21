-- Migration: Add Indexes for print_jobs
-- Description: Optimizes queries for user history, shop status, and expiration checks.

CREATE INDEX IF NOT EXISTS idx_print_jobs_user_id ON print_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_id_status ON print_jobs(shop_id, status);

-- Also index drafts for cleanup efficiency
CREATE INDEX IF NOT EXISTS idx_print_job_drafts_status ON print_job_drafts(status);
CREATE INDEX IF NOT EXISTS idx_print_job_drafts_created_at ON print_job_drafts(created_at);
