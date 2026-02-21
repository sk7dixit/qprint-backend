import pool from "./src/config/db.js";

async function dropConstraint() {
    try {
        console.log("Dropping constraint check_print_job_payment_status from print_jobs...");
        await pool.query("ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS check_print_job_payment_status");
        console.log("✅ Payment Constraint dropped successfully.");
    } catch (error) {
        console.error("❌ Error dropping constraint:", error);
    } finally {
        await pool.end();
    }
}

dropConstraint();
