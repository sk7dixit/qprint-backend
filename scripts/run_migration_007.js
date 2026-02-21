import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const runMigration = async () => {
    try {
        const sqlPath = path.join(process.cwd(), '007_add_extracted_text.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("🚀 Running migration: Add extracted_text column...");
        await pool.query(sql);
        console.log("✅ extracted_text column added successfully");

        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
};

runMigration();
