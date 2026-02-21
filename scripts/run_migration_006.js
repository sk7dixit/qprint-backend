import pool from '../src/config/db.js';
import fs from 'fs';
import path from 'path';

const runMigration = async () => {
    try {
        const sqlPath = path.resolve('scripts/006_enforce_status_enum.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("🚀 Running migration: Enforce Status Enums...");
        await pool.query(sql);
        console.log("✅ Status constraints applied successfully");

        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
};

runMigration();
