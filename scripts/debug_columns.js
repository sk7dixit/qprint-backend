import pool from '../src/config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const checkCols = async () => {
    const tables = ['print_jobs', 'print_job_drafts', 'files'];
    for (const table of tables) {
        console.log(`\n--- Columns for ${table} ---`);
        try {
            const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table]);
            console.log(r.rows.map(row => row.column_name));
        } catch (e) {
            console.error(`Error checking ${table}:`, e.message);
        }
    }
    process.exit(0);
};
checkCols();
