import pool from '../src/config/db.js';
import fs from 'fs';
import path from 'path';

const runFix = async () => {
    try {
        const sqlPath = path.resolve('scripts/fix_constraints.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("🚀 Running combined fix (Drop -> Sanitize -> New Constraints)...");
        await pool.query(sql);
        console.log("✅ Combined fix applied successfully");

        process.exit(0);
    } catch (error) {
        console.error("❌ Fix failed:", error);
        process.exit(1);
    }
};

runFix();
