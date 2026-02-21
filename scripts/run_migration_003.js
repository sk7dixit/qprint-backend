import pool from '../src/config/db.js';
import fs from 'fs';
import path from 'path';

const runMigration = async () => {
    try {
        const sqlPath = path.resolve('scripts/003_rename_orders_to_print_jobs.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("🚀 Running migration: Rename orders to print_jobs...");
        await pool.query(sql);
        console.log("✅ Table renamed successfully");

        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
};

runMigration();
