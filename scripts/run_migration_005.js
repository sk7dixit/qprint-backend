import pool from '../src/config/db.js';
import fs from 'fs';
import path from 'path';

const runMigration = async () => {
    try {
        const sqlPath = path.resolve('scripts/005_add_cleanup_tracking.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("🚀 Running migration: Add Cleanup Tracking...");
        await pool.query(sql);
        console.log("✅ Cleanup tracking columns added successfully");

        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
};

runMigration();
