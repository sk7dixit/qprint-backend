
import pool from '../src/config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const check = async () => {
    try {
        const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'files'");
        console.log(JSON.stringify(r.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};
check();
