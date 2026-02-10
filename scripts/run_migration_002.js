
import fs from 'fs';
import path from 'path';
import pool from '../src/config/db.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
    const sqlPath = path.join(__dirname, '002_setup_orders_payment.sql');
    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Running migration: 002_setup_orders_payment.sql');
        await pool.query(sql);
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
};

runMigration();
