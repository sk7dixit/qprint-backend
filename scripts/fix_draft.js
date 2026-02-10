
import pool from '../src/config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const fix = async () => {
    try {
        await pool.query("UPDATE print_job_drafts SET converted_pdf_url = original_file_url, status = 'ready_for_preview' WHERE id = 3");
        console.log('✅ Updated draft 3');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};
fix();
