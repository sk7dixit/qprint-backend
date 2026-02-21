import pool from '../src/config/db.js';

const checkStatuses = async () => {
    try {
        const resJobs = await pool.query('SELECT DISTINCT status FROM print_jobs');
        console.log("📊 Current unique statuses in print_jobs:");
        resJobs.rows.forEach(row => console.log(`- ${row.status}`));

        const resPayment = await pool.query('SELECT DISTINCT payment_status FROM print_jobs');
        console.log("📊 Current unique payment_statuses in print_jobs:");
        resPayment.rows.forEach(row => console.log(`- ${row.payment_status}`));

        const resDrafts = await pool.query('SELECT DISTINCT status FROM print_job_drafts');
        console.log("📊 Current unique statuses in print_job_drafts:");
        resDrafts.rows.forEach(row => console.log(`- ${row.status}`));

        process.exit(0);
    } catch (error) {
        console.error("❌ Failed to check statuses:", error);
        process.exit(1);
    }
};

checkStatuses();
