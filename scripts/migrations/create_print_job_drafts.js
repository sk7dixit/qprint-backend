import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Creating print_job_drafts table...");

        await client.query(`
            CREATE TABLE IF NOT EXISTS print_job_drafts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                original_file_name VARCHAR(255) NOT NULL,
                original_file_type VARCHAR(50) NOT NULL,
                original_file_url TEXT NOT NULL,
                converted_pdf_url TEXT,
                source VARCHAR(50) NOT NULL, -- 'shop' | 'editor'
                status VARCHAR(50) DEFAULT 'uploaded', -- 'uploaded' | 'converting' | 'ready_for_preview' | 'edited' | 'ready_for_checkout'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("✅ print_job_drafts table created successfully.");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
