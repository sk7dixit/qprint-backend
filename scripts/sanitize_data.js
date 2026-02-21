import pool from '../src/config/db.js';

const sanitizeData = async () => {
    try {
        console.log("🧹 Sanitizing print_jobs statuses...");
        await pool.query("UPDATE print_jobs SET status = 'PENDING_PAYMENT' WHERE status = 'created'");
        await pool.query("UPDATE print_jobs SET status = 'QUEUED' WHERE status = 'queued'");
        await pool.query("UPDATE print_jobs SET payment_status = 'PENDING_PAYMENT' WHERE payment_status = 'pending'");
        await pool.query("UPDATE print_jobs SET payment_status = 'PAID' WHERE payment_status = 'paid'");

        console.log("🧹 Sanitizing print_job_drafts statuses...");
        await pool.query("UPDATE print_job_drafts SET status = 'printed' WHERE status = 'ordered'");

        console.log("✅ Data sanitization complete.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Sanitization failed:", error);
        process.exit(1);
    }
};

sanitizeData();
