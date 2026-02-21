
CREATE TABLE IF NOT EXISTS payment_receipts (
    id SERIAL PRIMARY KEY,
    print_job_id INTEGER NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    shop_id INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    payment_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_user ON payment_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_expiry ON payment_receipts(expires_at);
