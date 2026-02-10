
import pool from '../src/config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const checkSchema = async () => {
    try {
        const result = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users'");
        console.log(JSON.stringify(result.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

checkSchema();
