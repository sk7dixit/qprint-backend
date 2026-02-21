
-- Add constraints to enforce valid status and payment_status values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_status_check') THEN
        ALTER TABLE print_jobs
        ADD CONSTRAINT valid_status_check
        CHECK (status IN (
            'CREATED',
            'PENDING_PAYMENT',
            'QUEUED',
            'PRINTING',
            'COMPLETED',
            'CANCELLED',
            'PROCESSING_PAYMENT' -- Added to support temporary state in controller
        ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_payment_status_check') THEN
        ALTER TABLE print_jobs
        ADD CONSTRAINT valid_payment_status_check
        CHECK (payment_status IN (
            'PENDING',
            'CONFIRMED',
            'PAID',
            'FAILED'
        ));
    END IF;
END $$;
