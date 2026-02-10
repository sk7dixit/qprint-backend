
-- Migration: Setup Orders Payment and File Tracking
-- Description: Adds draft_id, print_options, amount, payment_status, and final_pdf_url to orders table

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS draft_id INTEGER REFERENCES print_job_drafts(id),
ADD COLUMN IF NOT EXISTS print_options JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
ADD COLUMN IF NOT EXISTS final_pdf_url TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_draft_id ON orders(draft_id);
