import pool from "./src/config/db.js";

async function checkStatus() {
    try {
        console.log("Checking statuses...");
        // 1. Create dummy draft
        const res = await pool.query("INSERT INTO print_job_drafts (user_id, original_file_name, original_file_type, original_file_url, converted_pdf_url, page_count, status) VALUES (1, 'test', 'pdf', 'url', 'url', 1, 'uploaded') RETURNING id"); // Assuming 'uploaded' is valid start status? Or 'pending'?
        // Wait, if 'uploaded' is invalid, this will fail.
        // User said "status IN ('pending', ...)"
        // Let's try 'pending' first.

        // Actually, let's just inspect the error message! It lists allowed values!
        // We will try an INVALID status to trigger the error which lists valid ones.

        await pool.query("INSERT INTO print_job_drafts (user_id, original_file_name, original_file_type, original_file_url, converted_pdf_url, page_count, status) VALUES (1, 'test', 'pdf', 'url', 'url', 1, 'INVALID_STATUS_XYZ')");

    } catch (error) {
        console.log("Caught Error (Expected):");
        console.log(error.message);
    } finally {
        await pool.end();
    }
}

checkStatus();
