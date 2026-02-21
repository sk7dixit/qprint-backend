import pool from '../src/config/db.js';
import fs from 'fs';
import path from 'path';

const runMigration = async () => {
    try {
        const sqlPath = path.resolve('scripts/004_add_indexes.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("🚀 Running migration: Add Indexes...");
        await pool.query(sql);
        console.log("✅ Indexes created successfully");

        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
};

runMigration();
