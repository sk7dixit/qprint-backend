-- Migration: Rename orders to print_jobs
-- Description: Standardizes domain model to 'print_jobs' and removes 'orders' terminology.

-- 1. Rename the table
ALTER TABLE IF EXISTS orders RENAME TO print_jobs;

-- 2. Rename the sequence (if it exists and was named after orders)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orders_id_seq') THEN
        ALTER SEQUENCE orders_id_seq RENAME TO print_jobs_id_seq;
    END IF;
END $$;

-- 3. Update Indexes (Optional but good for consistency)
ALTER INDEX IF EXISTS idx_orders_payment_status RENAME TO idx_print_jobs_payment_status;
ALTER INDEX IF EXISTS idx_orders_draft_id RENAME TO idx_print_jobs_draft_id;

-- 4. Ensure created_at and updated_at exist (sanity check)
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now();
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
